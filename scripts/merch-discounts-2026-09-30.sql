-- Additive migration. Apply before deploying the discount editor.
-- Existing checkout continues using price_cents; stock and orders are untouched.
begin;
do $migration$
begin
  -- Seed the confirmed September 29 offers only on first installation.
  -- A rerun must never reactivate a discount the owner has since turned off.
  if not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='merch_products' and column_name='discount_percent') then
    alter table public.merch_products add column discount_percent integer not null default 0
      check (discount_percent between 0 and 99);
    alter table public.merch_variants add column compare_at_price_cents integer
      check (compare_at_price_cents is null or compare_at_price_cents > price_cents);
    update public.merch_products p set discount_percent=40
    where p.handle in ('black-daisy-chain-recordings-tee','brown-hoodie','faded-black-daisy-tee')
      and exists(select 1 from public.merch_variants v where v.product_id=p.id)
      and not exists(select 1 from public.merch_variants v where v.product_id=p.id
        and (v.currency <> 'usd' or v.price_cents <> case when p.handle='brown-hoodie' then 3900 else 2700 end));
    update public.merch_variants v set compare_at_price_cents=case when p.handle='brown-hoodie' then 6500 else 4500 end
    from public.merch_products p where v.product_id=p.id and p.discount_percent=40;
  end if;
end;
$migration$;

create or replace function public.save_merch_product(payload jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v jsonb;
  discount integer;
  regular_cents integer;
  sale_cents integer;
  compare_cents integer;
  previous merch_variants%rowtype;
begin
  -- Serialize edits to this product, including requests from the previous UI.
  perform 1 from merch_products where id = payload->>'id' for update;
  if payload ? 'discount_percent' then
    if jsonb_typeof(payload->'discount_percent') <> 'number'
      or (payload->>'discount_percent')::numeric <> trunc((payload->>'discount_percent')::numeric)
      or (payload->>'discount_percent')::numeric not between 0 and 99 then
      raise exception 'Discount must be a whole number from 0 to 99';
    end if;
    discount := (payload->>'discount_percent')::integer;
    if discount is null then raise exception 'Discount is required'; end if;
  else
    select discount_percent into discount from merch_products where id = payload->>'id';
    discount := coalesce(discount, 0);
  end if;
  insert into merch_products(id, handle, title, description, product_type, active, images, options, tags, discount_percent)
  values(payload->>'id', payload->>'handle', payload->>'title', payload->>'description', payload->>'product_type',
    (payload->>'active')::boolean, payload->'images', payload->'options', coalesce(payload->'tags', '[]'::jsonb), discount)
  on conflict (id) do update set handle = excluded.handle, title = excluded.title, description = excluded.description,
    product_type = excluded.product_type, active = excluded.active, images = excluded.images, options = excluded.options,
    discount_percent = excluded.discount_percent,
    tags = case when payload ? 'tags' then excluded.tags else merch_products.tags end;
  for v in select value from jsonb_array_elements(payload->'merch_variants') loop
    if exists(select 1 from merch_variants where id = v->>'id' and product_id <> payload->>'id') then raise exception 'Variant belongs to another product'; end if;
    select * into previous from merch_variants where id = v->>'id' for update;
    if payload ? 'discount_percent' then
      if jsonb_typeof(v->'regular_price_cents') is distinct from 'number'
        or (v->>'regular_price_cents')::numeric <> trunc((v->>'regular_price_cents')::numeric)
        or (v->>'regular_price_cents')::numeric not between 1 and 10000000 then
        raise exception 'Invalid regular price';
      end if;
      regular_cents := (v->>'regular_price_cents')::integer;
      sale_cents := round(regular_cents::numeric * (100 - discount) / 100)::integer;
      compare_cents := case when discount > 0 then regular_cents else null end;
      if sale_cents < 1 or (discount > 0 and sale_cents >= regular_cents) then
        raise exception 'Discount must reduce the price and keep it above zero';
      end if;
    else
      -- Older deployed editors may save descriptions/photos with current prices.
      -- Never let one silently overwrite an active offer or add an unsale-priced size.
      sale_cents := (v->>'price_cents')::integer;
      if discount > 0 and (previous.id is null or sale_cents is distinct from previous.price_cents) then
        raise exception 'Use the updated product editor to change sale prices';
      end if;
      compare_cents := previous.compare_at_price_cents;
    end if;
    insert into merch_variants(id, product_id, title, sku, price_cents, compare_at_price_cents, active, selected_options, sort_order)
      values(v->>'id', payload->>'id', v->>'title', v->>'sku', sale_cents, compare_cents,
        (v->>'active')::boolean, v->'selected_options', (v->>'sort_order')::integer)
      on conflict(id) do update set title = excluded.title, sku = excluded.sku, price_cents = excluded.price_cents,
        compare_at_price_cents = excluded.compare_at_price_cents,
        active = excluded.active, selected_options = excluded.selected_options, sort_order = excluded.sort_order;
  end loop;
  -- Every existing size must be included so a product-wide discount stays coherent.
  if exists(select 1 from merch_variants where product_id = payload->>'id'
    and id not in (select value->>'id' from jsonb_array_elements(payload->'merch_variants'))) then
    raise exception 'Include every existing size when saving a product';
  end if;
end;
$$;
revoke all on function public.save_merch_product(jsonb) from public, anon, authenticated;
grant execute on function public.save_merch_product(jsonb) to service_role;

commit;
