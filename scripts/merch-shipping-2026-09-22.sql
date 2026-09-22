-- Manual reconciliation: tracking is optional; payment and stock holds still apply.
begin;
create or replace function public.update_merch_order(order_id uuid, next_status text, tracking text, note text, resolve_stock boolean default false)
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
commit;
