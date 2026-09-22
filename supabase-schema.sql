-- Run this SQL in the Supabase SQL Editor to set up the database schema.

-- Profiles table (auto-created on user signup via trigger)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  has_unlimited_pass boolean not null default false,
  unlimited_pass_purchased_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Purchases table (one row per release purchase)
create table if not exists public.purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  release_slug text not null,
  stripe_session_id text not null,
  purchased_at timestamptz not null default now(),
  unique(user_id, release_slug)
);

alter table public.purchases enable row level security;

create policy "Users can read their own purchases"
  on public.purchases for select
  using (auth.uid() = user_id);

-- Service role can insert purchases (from webhook)
create policy "Service role can insert purchases"
  on public.purchases for insert
  with check (true);

-- Service role can update profiles (for unlimited pass)
create policy "Service role can update profiles"
  on public.profiles for update
  using (true);

-- Service role can insert profiles
create policy "Service role can insert profiles"
  on public.profiles for insert
  with check (true);

-- Trigger: auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Download tokens (one-time download links sent via email)
create table if not exists public.download_tokens (
  id uuid default gen_random_uuid() primary key,
  token text not null unique,
  slug text not null,
  email text not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
alter table public.download_tokens enable row level security;
create policy "Service role full access" on public.download_tokens for all using (true) with check (true);
create index idx_download_tokens_token on public.download_tokens (token);

-- Guest purchases (saves guest email + purchase data, separate from auth-required purchases table)
create table if not exists public.guest_purchases (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  release_slug text not null,
  stripe_session_id text not null,
  track_key text,
  purchased_at timestamptz not null default now()
);
alter table public.guest_purchases enable row level security;
create policy "Service role full access on guest_purchases" on public.guest_purchases for all using (true) with check (true);
create index idx_guest_purchases_email on public.guest_purchases (email);

-- Per-track purchasing support (added 2026-05-07)
-- track_key: NULL = full release purchase, non-null = individual track (Sanity _key)
-- The unique constraint on purchases uses COALESCE so NULL (full release) deduplicates correctly.
-- Migration:
--   ALTER TABLE purchases ADD COLUMN IF NOT EXISTS track_key TEXT;
--   ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_user_id_release_slug_key;
--   CREATE UNIQUE INDEX IF NOT EXISTS purchases_user_release_track ON purchases(user_id, release_slug, COALESCE(track_key, '__full__'));
--   ALTER TABLE guest_purchases ADD COLUMN IF NOT EXISTS track_key TEXT;

-- Stripe webhook idempotency (added 2026-06-12)
-- The webhook claims each event.id here exactly once; a duplicate insert (23505)
-- means we already processed it and can skip. Without this table the webhook
-- still works (fails open) but won't dedup duplicate Stripe deliveries.
create table if not exists public.processed_stripe_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);
alter table public.processed_stripe_events enable row level security;
create policy "Service role full access on processed_stripe_events"
  on public.processed_stripe_events for all using (true) with check (true);

-- Dedup guest purchases on (session, track) so a duplicate Stripe delivery can't
-- create a second guest_purchases row / download token / email (added 2026-06-12).
create unique index if not exists guest_purchases_session_track
  on public.guest_purchases (stripe_session_id, coalesce(track_key, '__full__'));

-- ─── 2026-08-06 audit: RLS remediation ───────────────────────────────────
-- The "Service role …" policies below/above have no TO clause, so they applied
-- to PUBLIC (including the browser-shipped anon key) rather than to the service
-- role, which bypasses RLS anyway. Dropped here so a fresh run of this file
-- does not recreate the leak. See scripts/fix-rls-2026-08-06.sql.
drop policy if exists "Service role can update profiles"                    on public.profiles;
drop policy if exists "Service role can insert profiles"                    on public.profiles;
drop policy if exists "Service role can insert purchases"                   on public.purchases;
drop policy if exists "Service role full access"                            on public.download_tokens;
drop policy if exists "Service role full access on guest_purchases"         on public.guest_purchases;
drop policy if exists "Service role full access on processed_stripe_events" on public.processed_stripe_events;
revoke all on public.download_tokens         from anon, authenticated;
revoke all on public.guest_purchases         from anon, authenticated;
revoke all on public.processed_stripe_events from anon, authenticated;


-- MERCH: canonical schema, introduced 2026-09-14.
-- Run in the Supabase SQL editor before switching the storefront to this branch.
begin;

create table public.merch_products (
  id text primary key,
  handle text not null unique,
  title text not null,
  description text not null default '',
  product_type text not null default '',
  active boolean not null default true,
  images jsonb not null default '[]',
  options jsonb not null default '[]',
  tags jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.merch_variants (
  id text primary key,
  product_id text not null references public.merch_products(id),
  title text not null,
  sku text not null default '',
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'usd' check (currency = 'usd'),
  stock integer not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  selected_options jsonb not null default '[]'
);
create index on public.merch_variants(product_id);

-- An immutable, server-priced snapshot, written before creating Stripe Checkout.
create table public.merch_checkouts (
  id uuid primary key default gen_random_uuid(),
  items jsonb not null,
  livemode boolean not null,
  created_at timestamptz not null default now()
);

create table public.merch_orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  stripe_session_id text not null unique,
  stripe_payment_intent_id text,
  livemode boolean not null,
  email text not null default '',
  customer_name text not null default '',
  phone text not null default '',
  shipping_address jsonb not null,
  items jsonb not null check (jsonb_array_length(items) > 0),
  currency text not null default 'usd',
  subtotal_cents integer not null,
  shipping_cents integer not null,
  discount_cents integer not null,
  tax_cents integer not null,
  total_cents integer not null,
  payment_status text not null default 'paid' check (payment_status in ('paid', 'partially_refunded', 'refunded', 'disputed')),
  fulfillment_status text not null default 'new' check (fulfillment_status in ('new', 'exported', 'shipped', 'on_hold')),
  inventory_issue boolean not null default false,
  exported_at timestamptz,
  shipped_at timestamptz,
  tracking_number text,
  notes text not null default '',
  confirmation_email_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.merch_orders(created_at desc);
create index on public.merch_orders(stripe_payment_intent_id);

create table public.merch_inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  variant_id text not null references public.merch_variants(id),
  quantity_delta integer not null,
  reason text not null,
  order_id uuid references public.merch_orders(id),
  request_id uuid unique,
  created_at timestamptz not null default now()
);

-- A refund can arrive before checkout.session.completed. Persist the payment
-- block independently, then apply it when the order is first recorded.
create table public.merch_payment_blocks (
  payment_intent_id text primary key,
  status text not null check (status in ('partially_refunded', 'refunded', 'disputed'))
);

-- Server access only: a public Supabase key cannot read customer addresses,
-- manipulate inventory, or forge a paid order. Public catalog uses our server.
alter table public.merch_products enable row level security;
alter table public.merch_variants enable row level security;
alter table public.merch_checkouts enable row level security;
alter table public.merch_orders enable row level security;
alter table public.merch_inventory_adjustments enable row level security;
alter table public.merch_payment_blocks enable row level security;
revoke all on public.merch_products, public.merch_variants, public.merch_checkouts,
  public.merch_orders, public.merch_inventory_adjustments, public.merch_payment_blocks from anon, authenticated;
grant all on public.merch_products, public.merch_variants, public.merch_checkouts,
  public.merch_orders, public.merch_inventory_adjustments, public.merch_payment_blocks to service_role;
grant usage, select on sequence public.merch_orders_order_number_seq to service_role;

create function public.record_merch_order(payload jsonb, deduct_inventory boolean default true)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  saved merch_orders;
  line jsonb;
  remaining integer;
  blocked text;
begin
  -- Serializes an order with both its retries and refund/dispute events.
  perform pg_advisory_xact_lock(hashtextextended(coalesce(payload->>'stripe_payment_intent_id', payload->>'stripe_session_id'), 0));
  select * into saved from merch_orders where stripe_session_id = payload->>'stripe_session_id';
  if found then return jsonb_build_object('id', saved.id, 'created', false); end if;

  select status into blocked from merch_payment_blocks where payment_intent_id = payload->>'stripe_payment_intent_id';
  insert into merch_orders (stripe_session_id, stripe_payment_intent_id, livemode,
    email, customer_name, phone, shipping_address, items, currency, subtotal_cents,
    shipping_cents, discount_cents, tax_cents, total_cents, payment_status, fulfillment_status, created_at)
  values (payload->>'stripe_session_id', payload->>'stripe_payment_intent_id', (payload->>'livemode')::boolean,
    coalesce(payload->>'email', ''), coalesce(payload->>'customer_name', ''), coalesce(payload->>'phone', ''), payload->'shipping_address', payload->'items',
    coalesce(payload->>'currency', 'usd'), coalesce((payload->>'subtotal_cents')::integer, 0), coalesce((payload->>'shipping_cents')::integer, 0),
    coalesce((payload->>'discount_cents')::integer, 0), coalesce((payload->>'tax_cents')::integer, 0), coalesce((payload->>'total_cents')::integer, 0),
    coalesce(blocked, 'paid'), case when blocked is null then 'new' else 'on_hold' end,
    coalesce((payload->>'created_at')::timestamptz, now()))
  returning * into saved;

  if saved.livemode and deduct_inventory then
    -- Stable lock order avoids deadlocks between carts with overlapping items.
    for line in select value from jsonb_array_elements(saved.items) order by value->>'variant_id' loop
      if (line->>'quantity')::integer < 1 then raise exception 'Invalid order quantity'; end if;
      update merch_variants set stock = stock - (line->>'quantity')::integer
        where id = line->>'variant_id' returning stock into remaining;
      if not found then
        update merch_orders set inventory_issue = true, fulfillment_status = 'on_hold' where id = saved.id;
      else
        insert into merch_inventory_adjustments (variant_id, quantity_delta, reason, order_id)
          values (line->>'variant_id', -(line->>'quantity')::integer, 'Online order', saved.id);
        -- Never lose an already-paid order to a stock race. Keep the shortage
        -- visible and block shipping export until staff reconcile it.
        if remaining < 0 then
          update merch_orders set inventory_issue = true, fulfillment_status = 'on_hold' where id = saved.id;
        end if;
      end if;
    end loop;
  end if;
  select * into saved from merch_orders where id = saved.id;
  return jsonb_build_object('id', saved.id, 'created', true, 'inventory_issue', saved.inventory_issue, 'fulfillment_status', saved.fulfillment_status);
end;
$$;

create function public.adjust_merch_inventory(variant text, delta integer, reason_text text, request_key uuid)
returns integer language plpgsql security invoker set search_path = public as $$
declare remaining integer;
begin
  if delta = 0 or abs(delta::bigint) > 100000 or length(trim(reason_text)) not between 1 and 300 then
    raise exception 'Enter a quantity change and a reason';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(request_key::text, 0));
  if exists (select 1 from merch_inventory_adjustments where request_id = request_key and (variant_id <> variant or quantity_delta <> delta or reason <> trim(reason_text))) then raise exception 'Adjustment key was already used for another change'; end if;
  if exists (select 1 from merch_inventory_adjustments where request_id = request_key) then
    select stock into remaining from merch_variants where id = variant;
    return remaining;
  end if;
  update merch_variants set stock = stock + delta where id = variant and stock + delta >= 0 returning stock into remaining;
  if not found then raise exception 'Item missing or adjustment would make stock negative'; end if;
  insert into merch_inventory_adjustments (variant_id, quantity_delta, reason, request_id)
    values (variant, delta, trim(reason_text), request_key);
  return remaining;
end;
$$;

create function public.block_merch_payment(intent text, new_status text)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if new_status not in ('partially_refunded', 'refunded', 'disputed') then raise exception 'Invalid status'; end if;
  perform pg_advisory_xact_lock(hashtextextended(intent, 0));
  insert into merch_payment_blocks (payment_intent_id, status) values (intent, new_status)
    on conflict (payment_intent_id) do update set status = case
      when merch_payment_blocks.status = 'disputed' or excluded.status = 'disputed' then 'disputed'
      when merch_payment_blocks.status = 'refunded' or excluded.status = 'refunded' then 'refunded'
      else 'partially_refunded' end;
  update merch_orders set payment_status = (select status from merch_payment_blocks where payment_intent_id = intent),
    fulfillment_status = case when fulfillment_status = 'shipped' then 'shipped' else 'on_hold' end
    where stripe_payment_intent_id = intent;
end;
$$;

revoke all on function public.record_merch_order(jsonb, boolean), public.adjust_merch_inventory(text, integer, text, uuid),
  public.block_merch_payment(text, text) from public, anon, authenticated;
grant execute on function public.record_merch_order(jsonb, boolean), public.adjust_merch_inventory(text, integer, text, uuid),
  public.block_merch_payment(text, text) to service_role;

create table public.merch_exports (
  id uuid primary key,
  order_ids uuid[] not null,
  created_at timestamptz not null default now()
);
alter table public.merch_exports enable row level security;
revoke all on public.merch_exports from anon, authenticated;
grant all on public.merch_exports to service_role;

create function public.export_merch_orders(ids uuid[], request_key uuid, reexport boolean default false)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  row merch_orders;
  result jsonb := '[]';
  n integer := 0;
  previous uuid[];
begin
  if coalesce(array_length(ids, 1), 0) not between 1 and 100 then raise exception 'Select 1 to 100 orders'; end if;
  perform pg_advisory_xact_lock(hashtextextended(request_key::text, 0));
  select order_ids into previous from merch_exports where id = request_key;
  if found and not (previous @> ids and ids @> previous) then raise exception 'Export key already used'; end if;
  for row in select * from merch_orders where id = any(ids) order by id for update loop
    n := n + 1;
    if not row.livemode or row.payment_status not in ('paid', 'partially_refunded') or row.inventory_issue
      or row.fulfillment_status not in ('new', 'exported')
      or (row.fulfillment_status = 'exported' and not reexport and previous is null)
      or coalesce(row.customer_name, '') = ''
      or coalesce(row.shipping_address->>'line1', '') = ''
      or coalesce(row.shipping_address->>'city', '') = ''
      or coalesce(row.shipping_address->>'country', '') = ''
      or coalesce(row.shipping_address->>'postal_code', '') = ''
      or (row.shipping_address->>'country' = 'US' and coalesce(row.shipping_address->>'state', '') = '') then
      raise exception 'Order % cannot be exported. Refresh and review its status/address.', row.order_number;
    end if;
    update merch_orders set fulfillment_status = 'exported', exported_at = coalesce(exported_at, now()) where id = row.id;
    result := result || jsonb_build_array(to_jsonb(row));
  end loop;
  if n <> array_length(ids, 1) then raise exception 'Order missing or selected twice'; end if;
  insert into merch_exports(id, order_ids) values(request_key, ids) on conflict do nothing;
  return result;
end;
$$;

create function public.update_merch_order(order_id uuid, next_status text, tracking text, note text, resolve_stock boolean default false)
returns void language plpgsql security invoker set search_path = public as $$
declare row merch_orders;
begin
  select * into row from merch_orders where id = order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if next_status not in ('new', 'on_hold', 'shipped', 'exported') then raise exception 'Invalid status'; end if;
  if next_status = 'exported' and row.fulfillment_status <> 'exported' then raise exception 'Use CSV export to mark exported'; end if;
  if row.payment_status in ('refunded', 'disputed') and next_status not in ('on_hold', row.fulfillment_status) then
    raise exception 'Refunded/disputed orders must remain on hold';
  end if;
  if row.inventory_issue and not resolve_stock and next_status not in ('on_hold', row.fulfillment_status) then raise exception 'Resolve the inventory issue first'; end if;
  if resolve_stock then
    if length(trim(note)) = 0 then raise exception 'Explain how the inventory issue was resolved'; end if;
    if exists (select 1 from jsonb_array_elements(row.items) i left join merch_variants v on v.id = i->>'variant_id' where v.id is null or v.stock < 0) then
      raise exception 'Correct missing items or negative stock before releasing this order';
    end if;
  end if;
  if next_status = 'shipped' and not row.livemode then raise exception 'A live order is required'; end if;
  if length(note) > 2000 or length(tracking) > 200 then raise exception 'Note or tracking number too long'; end if;
  update merch_orders set fulfillment_status = next_status,
    tracking_number = nullif(trim(tracking), ''), notes = note,
    inventory_issue = case when resolve_stock then false else inventory_issue end,
    shipped_at = case when next_status = 'shipped' then coalesce(shipped_at, now()) else null end
    where id = order_id;
end;
$$;
revoke all on function public.export_merch_orders(uuid[], uuid, boolean), public.update_merch_order(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.export_merch_orders(uuid[], uuid, boolean), public.update_merch_order(uuid, text, text, text, boolean) to service_role;

create function public.save_merch_product(payload jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare v jsonb;
begin
  insert into merch_products(id, handle, title, description, product_type, active, images, options, tags)
  values(payload->>'id', payload->>'handle', payload->>'title', payload->>'description', payload->>'product_type',
    (payload->>'active')::boolean, payload->'images', payload->'options', coalesce(payload->'tags', '[]'::jsonb))
  on conflict (id) do update set handle = excluded.handle, title = excluded.title, description = excluded.description,
    product_type = excluded.product_type, active = excluded.active, images = excluded.images, options = excluded.options,
    tags = case when payload ? 'tags' then excluded.tags else merch_products.tags end;
  for v in select value from jsonb_array_elements(payload->'merch_variants') loop
    if exists(select 1 from merch_variants where id = v->>'id' and product_id <> payload->>'id') then raise exception 'Variant belongs to another product'; end if;
    insert into merch_variants(id, product_id, title, sku, price_cents, active, selected_options, sort_order)
      values(v->>'id', payload->>'id', v->>'title', v->>'sku', (v->>'price_cents')::integer,
        (v->>'active')::boolean, v->'selected_options', (v->>'sort_order')::integer)
      on conflict(id) do update set title = excluded.title, sku = excluded.sku, price_cents = excluded.price_cents,
        active = excluded.active, selected_options = excluded.selected_options, sort_order = excluded.sort_order;
  end loop;
end;
$$;
revoke all on function public.save_merch_product(jsonb) from public, anon, authenticated;
grant execute on function public.save_merch_product(jsonb) to service_role;
commit;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('merch-images', 'merch-images', true, 10000000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Bandcamp physical-order extension (scripts/merch-bandcamp-2026-09-22.sql)
-- Add Bandcamp orders to the existing shipping queue. Safe to rerun.
-- Existing website orders, shipping decisions and inventory are preserved.
begin;
alter table public.merch_orders alter column stripe_session_id drop not null;
alter table public.merch_orders add column if not exists source text not null default 'website';
alter table public.merch_orders add column if not exists source_order_id text;
alter table public.merch_orders add column if not exists source_data jsonb not null default '{}';
alter table public.merch_orders add column if not exists fulfillment_manually_updated boolean not null default false;
create unique index if not exists merch_orders_source_order_unique on public.merch_orders(source, source_order_id);
alter table public.merch_orders drop constraint if exists merch_orders_source_check;
alter table public.merch_orders add constraint merch_orders_source_check check (
  (source = 'website' and stripe_session_id is not null) or
  (source = 'bandcamp' and source_order_id is not null and stripe_session_id is null and stripe_payment_intent_id is null)
);
alter table public.merch_orders drop constraint if exists merch_orders_payment_status_check;
alter table public.merch_orders add constraint merch_orders_payment_status_check
  check (payment_status in ('paid','partially_refunded','refunded','disputed','pending','failed'));

create or replace function public.record_bandcamp_order(payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare saved merch_orders; changed boolean;
begin
  if coalesce(payload->>'source_order_id', '') !~ '^[0-9]+:[0-9]+$'
    or coalesce(payload->>'payment_status', '') not in ('paid','partially_refunded','refunded','pending','failed')
    or coalesce(payload->>'fulfillment_status', '') not in ('new','shipped','on_hold')
    or jsonb_typeof(payload->'items') is distinct from 'array'
    or jsonb_array_length(payload->'items') < 1 then raise exception 'Invalid Bandcamp order'; end if;
  perform pg_advisory_xact_lock(hashtextextended('bandcamp:' || (payload->>'source_order_id'), 0));
  select * into saved from merch_orders where source='bandcamp' and source_order_id=payload->>'source_order_id' for update;
  if found then
    -- A changed purchased-item/address snapshot needs explicit reconciliation.
    -- Never silently replace a packed order or lose a newly added item.
    changed := saved.items <> payload->'items' or saved.shipping_address <> payload->'shipping_address'
      or saved.customer_name <> payload->>'customer_name' or saved.email <> payload->>'email' or saved.phone <> payload->>'phone'
      or saved.currency <> payload->>'currency'
      or saved.subtotal_cents <> (payload->>'subtotal_cents')::integer
      or saved.shipping_cents <> (payload->>'shipping_cents')::integer
      or saved.tax_cents <> (payload->>'tax_cents')::integer or saved.total_cents <> (payload->>'total_cents')::integer;
    update merch_orders set payment_status=payload->>'payment_status', source_data=(payload->'source_data') || jsonb_build_object('review_needed', changed) || case when changed then jsonb_build_object('pending',payload) else '{}'::jsonb end,
      fulfillment_status=case
        when changed and saved.fulfillment_status <> 'shipped' then 'on_hold'
        when not saved.fulfillment_manually_updated and not changed and payload->'source_data'->'ship_dates' is distinct from saved.source_data->'ship_dates'
          then case when saved.exported_at is not null and payload->>'fulfillment_status' = 'new' then 'on_hold' else payload->>'fulfillment_status' end
        when saved.payment_status <> payload->>'payment_status' and payload->>'payment_status' <> 'paid' and saved.fulfillment_status <> 'shipped' then 'on_hold'
        else saved.fulfillment_status end,
      shipped_at=case when not saved.fulfillment_manually_updated and not changed and payload->'source_data'->'ship_dates' is distinct from saved.source_data->'ship_dates'
        then (payload->>'shipped_at')::timestamptz else saved.shipped_at end
      where id=saved.id;
    return jsonb_build_object('id',saved.id,'created',false,'review_needed',changed);
  end if;
  insert into merch_orders (source,source_order_id,source_data,livemode,email,customer_name,phone,
    shipping_address,items,currency,subtotal_cents,shipping_cents,discount_cents,tax_cents,total_cents,
    payment_status,fulfillment_status,shipped_at,notes,created_at)
  values ('bandcamp',payload->>'source_order_id',payload->'source_data',true,payload->>'email',payload->>'customer_name',payload->>'phone',
    payload->'shipping_address',payload->'items',payload->>'currency',(payload->>'subtotal_cents')::integer,
    (payload->>'shipping_cents')::integer,0,(payload->>'tax_cents')::integer,(payload->>'total_cents')::integer,
    payload->>'payment_status',payload->>'fulfillment_status',(payload->>'shipped_at')::timestamptz,
    payload->>'notes',(payload->>'created_at')::timestamptz) returning * into saved;
  -- Bandcamp owns its inventory; no Supabase stock deductions or email sends.
  return jsonb_build_object('id',saved.id,'created',true);
end;
$$;
revoke all on function public.record_bandcamp_order(jsonb) from public, anon, authenticated;
grant execute on function public.record_bandcamp_order(jsonb) to service_role;

-- Extend the existing shipping guard to unpaid Bandcamp orders.
create or replace function public.update_merch_order(order_id uuid, next_status text, tracking text, note text, resolve_stock boolean default false)
returns void language plpgsql security invoker set search_path = public as $$
declare row merch_orders;
begin
  select * into row from merch_orders where id = order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if next_status not in ('new', 'on_hold', 'shipped', 'exported') then raise exception 'Invalid status'; end if;
  if next_status = 'exported' and row.fulfillment_status <> 'exported' then raise exception 'Use CSV export to mark exported'; end if;
  if row.payment_status in ('refunded', 'disputed', 'pending', 'failed') and next_status not in ('on_hold', row.fulfillment_status) then
    raise exception 'Refunded, disputed or unpaid orders must remain on hold';
  end if;
  if row.inventory_issue and not resolve_stock and next_status not in ('on_hold', row.fulfillment_status) then raise exception 'Resolve the inventory issue first'; end if;
  if row.source_data->>'review_needed' = 'true' and next_status not in ('on_hold', row.fulfillment_status) then raise exception 'Reconcile changed Bandcamp order details first'; end if;
  if resolve_stock then
    if length(trim(note)) = 0 then raise exception 'Explain how the inventory issue was resolved'; end if;
    if exists (select 1 from jsonb_array_elements(row.items) i left join merch_variants v on v.id = i->>'variant_id' where v.id is null or v.stock < 0) then
      raise exception 'Correct missing items or negative stock before releasing this order';
    end if;
  end if;
  if next_status = 'shipped' and not row.livemode then raise exception 'A live order is required'; end if;
  if length(note) > 2000 or length(tracking) > 200 then raise exception 'Note or tracking number too long'; end if;
  update merch_orders set fulfillment_status = next_status,
    fulfillment_manually_updated = fulfillment_manually_updated or (source = 'bandcamp' and next_status <> fulfillment_status),
    tracking_number = nullif(trim(tracking), ''), notes = note,
    inventory_issue = case when resolve_stock then false else inventory_issue end,
    shipped_at = case when next_status = 'shipped' then coalesce(shipped_at, now()) else null end
    where id = order_id;
end;
$$;
revoke all on function public.update_merch_order(uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.update_merch_order(uuid,text,text,text,boolean) to service_role;
create or replace function public.export_merch_orders(ids uuid[], request_key uuid, reexport boolean default false)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  row merch_orders;
  result jsonb := '[]';
  n integer := 0;
  previous uuid[];
begin
  if coalesce(array_length(ids, 1), 0) not between 1 and 100 then raise exception 'Select 1 to 100 orders'; end if;
  perform pg_advisory_xact_lock(hashtextextended(request_key::text, 0));
  select order_ids into previous from merch_exports where id = request_key;
  if found and not (previous @> ids and ids @> previous) then raise exception 'Export key already used'; end if;
  for row in select * from merch_orders where id = any(ids) order by id for update loop
    n := n + 1;
    if not row.livemode or row.payment_status not in ('paid', 'partially_refunded') or row.inventory_issue
      or row.fulfillment_status not in ('new', 'exported')
      or row.source_data->>'review_needed' = 'true'
      or (row.fulfillment_status = 'exported' and not reexport and previous is null)
      or coalesce(row.customer_name, '') = ''
      or coalesce(row.shipping_address->>'line1', '') = ''
      or coalesce(row.shipping_address->>'city', '') = ''
      or coalesce(row.shipping_address->>'country', '') = ''
      or coalesce(row.shipping_address->>'postal_code', '') = ''
      or (row.shipping_address->>'country' = 'US' and coalesce(row.shipping_address->>'state', '') = '') then
      raise exception 'Order % cannot be exported. Refresh and review its status/address.', row.order_number;
    end if;
    update merch_orders set fulfillment_status = 'exported', exported_at = coalesce(exported_at, now()) where id = row.id;
    result := result || jsonb_build_array(to_jsonb(row));
  end loop;
  if n <> array_length(ids, 1) then raise exception 'Order missing or selected twice'; end if;
  insert into merch_exports(id, order_ids) values(request_key, ids) on conflict do nothing;
  return result;
end;
$$;

-- Staff review an updated Bandcamp snapshot before replacing a packed address/item list.
create or replace function public.accept_bandcamp_order(order_id uuid, review_note text, expected_snapshot jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare saved merch_orders; pending jsonb;
begin
  select * into saved from merch_orders where id=order_id and source='bandcamp' for update;
  if not found then raise exception 'Bandcamp order not found'; end if;
  if coalesce(length(trim(review_note)),0) not between 1 and 500 then raise exception 'Explain the Bandcamp detail review'; end if;
  if saved.source_data->>'review_needed' is distinct from 'true' then return; end if;
  pending := saved.source_data->'pending';
  if pending is distinct from expected_snapshot then raise exception 'Bandcamp details changed again; refresh and review the latest snapshot'; end if;
  if pending->>'source_order_id' is distinct from saved.source_order_id then raise exception 'Updated Bandcamp snapshot unavailable; run sync again'; end if;
  update merch_orders set items=pending->'items',shipping_address=pending->'shipping_address',
    customer_name=pending->>'customer_name',email=pending->>'email',phone=pending->>'phone',currency=pending->>'currency',
    subtotal_cents=(pending->>'subtotal_cents')::integer,shipping_cents=(pending->>'shipping_cents')::integer,
    tax_cents=(pending->>'tax_cents')::integer,total_cents=(pending->>'total_cents')::integer,
    source_data=(source_data - 'pending') || '{"review_needed":false}'::jsonb,
    fulfillment_status=case when fulfillment_status='shipped' then 'shipped' else 'on_hold' end,
    notes=left(notes || E'\nBandcamp details reviewed: ' || trim(review_note),2000)
    where id=order_id;
end;
$$;
revoke all on function public.accept_bandcamp_order(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.accept_bandcamp_order(uuid,text,jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
