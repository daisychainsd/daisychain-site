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
