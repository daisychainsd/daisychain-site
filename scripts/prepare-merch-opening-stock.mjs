// Generates a reviewable, transactional opening-stock SQL file; never connects to live services.
// Run from the repo root: node scripts/prepare-merch-opening-stock.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const source = JSON.parse(await readFile('.merch-import/catalog.json', 'utf8'));
const skuPlan = JSON.parse(await readFile('.merch-import/sku-photo-update.json', 'utf8'));
const draft = JSON.parse(await readFile('.merch-import/dc-staple-tee-draft.json', 'utf8'));
const counts = {
  'dc-staple-tee': { S: 3, M: 6, L: 12, XL: 8, XXL: 3 },
  'daisy-chain-records-disco-tee': { M: 4, L: 9, XL: 4, XXL: 1 },
  'black-daisy-chain-recordings-tee': { S: 4, M: 4, L: 4, XXL: 1 },
  'brown-hoodie': { S: 5, M: 4 },
  'faded-black-daisy-tee': { S: 3, M: 4 },
  'dream-disc-cd': { 'Default Title': 65 },
  'mini-daisy-chain': { 'Default Title': 100 },
  'the-daisy-chain-2-0': { 'Default Title': 100 },
  'beanie': { Black: 40 },
};
const saleHandles = new Set(['black-daisy-chain-recordings-tee', 'brown-hoodie', 'faded-black-daisy-tee']);
const normalize = size => ({ '2XL':'XXL', Small:'S', Medium:'M', Large:'L', 'X-Large':'XL', 'XX-Large':'XXL' })[size] || size;
const reason = 'Opening stock count supplied by PD — 2026-09-29';
function requestId(id) {
  const hex = createHash('sha256').update(`daisychain-opening-stock-2026-09-29:${id}`).digest('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
const nextSku = Math.max(...skuPlan.skus.map(s => Number(s.sku.slice(3)))) + 1;
const staple = { ...draft, options:[{name:'Size',values:Object.keys(counts['dc-staple-tee'])}], merch_variants:Object.keys(counts['dc-staple-tee']).map((title,i)=>({id:`merch-variant-dc-staple-tee-${title.toLowerCase()}`,product_id:draft.id,title,sku:`DCM${String(nextSku+i).padStart(2,'0')}`,price_cents:4500,currency:'usd',stock:0,active:true,sort_order:i,selected_options:[{name:'Size',value:title}]})) };
delete staple.planned_price_cents;delete staple.pending;
const products = [staple,...source].map(p => ({ id:p.id, handle:p.handle, title:p.title, discount_percent:saleHandles.has(p.handle)?40:0, variants:p.merch_variants.map(v=>({id:v.id,title:v.title,sku:skuPlan.skus.find(s=>s.id===v.id)?.sku||v.sku,stock:counts[p.handle]?.[normalize(v.title)]??0,original_price_cents:v.price_cents,price_cents:saleHandles.has(p.handle)?Math.round(v.price_cents*0.6):v.price_cents,request_id:requestId(v.id)})) }));
for(const [handle,sizes] of Object.entries(counts)){
  const p=products.find(p=>p.handle===handle);assert.ok(p,handle);
  for(const [size,stock] of Object.entries(sizes))assert.equal(p.variants.find(v=>normalize(v.title)===size)?.stock,stock,`${handle} / ${size}`);
}
const variants=products.flatMap(p=>p.variants);
assert.equal(variants.reduce((n,v)=>n+v.stock,0),384);
assert.equal(new Set(variants.map(v=>v.sku)).size,38);
assert.equal(variants.length,38);
assert.equal(products.find(p=>p.handle==='black-daisy-chain-recordings-tee').variants[0].price_cents,2700);
assert.equal(products.find(p=>p.handle==='brown-hoodie').variants[0].price_cents,3900);
assert.equal(products.find(p=>p.handle==='faded-black-daisy-tee').variants[0].price_cents,2700);
const plan={date:'2026-09-29',reason,total_units:384,products,staple_variants:staple.merch_variants,notes:['Stock values are opening totals, not additional restocks.','Unlisted sizes/products remain zero.','Grey shirt means Faded Black Daisy Tee.','Staple tee remains hidden until storefront cutover.','SQL preserves existing product images and descriptions. Apply pending SKU/photo plan separately.']};
await writeFile('.merch-import/opening-stock-plan.json',JSON.stringify(plan,null,2)+'\n');
const sqlJson = value => `'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const sql=`-- PD's opening counts and 40% sale prices, September 29, 2026.
-- 384 units, 38 variants. Transactional; replay never double-adds stock or compounds discounts.
-- Keeps the staple tee hidden and does not change catalog backend, customer orders or images.
-- Apply the pending SKU/photo plan separately. No old schema migration is required.
begin;
lock table public.merch_products, public.merch_variants, public.merch_inventory_adjustments in share row exclusive mode;
do $opening$
declare
  product_payload jsonb;
  planned jsonb;
  current_variant public.merch_variants%rowtype;
  prior_adjustment public.merch_inventory_adjustments%rowtype;
  target_stock integer;
begin
  select to_jsonb(p) into product_payload from public.merch_products p where p.id = 'merch-product-dc-staple-tee' and p.handle = 'dc-staple-tee';
  if product_payload is null then raise exception 'DC staple tee draft is missing'; end if;
  if exists(select 1 from public.merch_variants where product_id='merch-product-dc-staple-tee' and id not in (select value->>'id' from jsonb_array_elements(${sqlJson(staple.merch_variants)}))) then raise exception 'Staple tee sizes changed; review before applying'; end if;
  if exists(select 1 from public.merch_variants v join jsonb_array_elements(${sqlJson(staple.merch_variants)}) x on v.id=x->>'id' where v.price_cents <> 4500 or v.title <> x->>'title' or v.sku <> x->>'sku') then raise exception 'Staple tee variant details changed; review before applying'; end if;
  if exists(select 1 from public.merch_variants v join jsonb_array_elements(${sqlJson(staple.merch_variants)}) x on v.sku=x->>'sku' where v.id <> x->>'id') then raise exception 'A staple tee SKU is already assigned elsewhere'; end if;
  perform public.save_merch_product(product_payload || jsonb_build_object('options', ${sqlJson(staple.options)}, 'merch_variants', ${sqlJson(staple.merch_variants)}));
  for planned in select value from jsonb_array_elements(${sqlJson(variants)}) loop
    select * into current_variant from public.merch_variants where id=planned->>'id' for update;
    if not found then raise exception 'Variant % is missing', planned->>'id'; end if;
    target_stock := (planned->>'stock')::integer;
    select * into prior_adjustment from public.merch_inventory_adjustments where request_id=(planned->>'request_id')::uuid;
    if found then
      if prior_adjustment.variant_id <> planned->>'id' or prior_adjustment.quantity_delta <> target_stock then raise exception 'Opening adjustment differs for %', planned->>'id'; end if;
    else
      if current_variant.stock <> 0 then raise exception 'Stock changed for %: expected uncounted zero, found %. Review before applying.', planned->>'id', current_variant.stock; end if;
      if target_stock > 0 then
        perform public.adjust_merch_inventory(planned->>'id', target_stock, '${reason}', (planned->>'request_id')::uuid);
      end if;
    end if;
    if current_variant.price_cents not in ((planned->>'original_price_cents')::integer, (planned->>'price_cents')::integer) then raise exception 'Price changed for %. Review before applying.', planned->>'id'; end if;
    update public.merch_variants set price_cents=(planned->>'price_cents')::integer where id=planned->>'id';
  end loop;
end;
$opening$;
commit;
`;
await writeFile('.merch-import/opening-stock-2026-09-29.sql',sql);
const csvCell=x=>'"'+String(x).replaceAll('"','""')+'"';
const rows=[['Product','Size / option','SKU','Stock','Regular price USD','Sale price USD','Discount'],...products.flatMap(p=>p.variants.map(v=>[p.title,v.title,v.sku,v.stock,(v.original_price_cents/100).toFixed(2),(v.price_cents/100).toFixed(2),p.discount_percent?`${p.discount_percent}%`:'']))];
await writeFile('/Users/pd/Downloads/Daisy-Chain-confirmed-stock.csv',rows.map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n');
console.log(JSON.stringify({totalUnits:384,variants:38,stockedProducts:products.filter(p=>p.variants.some(v=>v.stock>0)).length,totals:products.filter(p=>p.variants.some(v=>v.stock>0)).map(p=>({product:p.title,total:p.variants.reduce((n,v)=>n+v.stock,0),price:p.variants[0].price_cents/100})),liveChanges:false},null,2));
