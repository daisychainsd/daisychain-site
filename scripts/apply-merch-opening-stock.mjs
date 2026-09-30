// Read-only preflight: node --env-file=.env.local scripts/apply-merch-opening-stock.mjs
// Apply user-confirmed opening counts/prices: add --apply. Reuse the same saved plan on retries.
// Uses existing service-role RPCs. Does not deploy code, publish products or switch checkout backends.
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
const plan = JSON.parse(await readFile('.merch-import/opening-stock-plan.json', 'utf8'));
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{ persistSession:false, autoRefreshToken:false } });
const [catalog, adjustments] = await Promise.all([
  db.from('merch_products').select('*,merch_variants(*)'),
  db.from('merch_inventory_adjustments').select('request_id,variant_id,quantity_delta,reason').in('request_id',plan.products.flatMap(p=>p.variants.map(v=>v.request_id))),
]);
if (catalog.error || adjustments.error) throw new Error('Cannot read current catalog and opening-stock ledger');
const current = catalog.data.flatMap(p=>p.merch_variants);
const staple = catalog.data.find(p=>p.id==='merch-product-dc-staple-tee');
if (!staple || staple.handle !== 'dc-staple-tee') throw new Error('DC staple tee draft is missing');
const newIds = new Set(plan.staple_variants.map(v=>v.id));
if (staple.merch_variants.some(v=>!newIds.has(v.id))) throw new Error('Staple tee sizes changed; review before applying');
for (const p of plan.products) {
  if (!catalog.data.some(live=>live.id===p.id && live.handle===p.handle)) throw new Error(`Product changed: ${p.title}`);
  for (const v of p.variants) {
    const live = current.find(row=>row.id===v.id);
    const recorded = adjustments.data.find(row=>row.request_id===v.request_id);
    if (!live && !newIds.has(v.id)) throw new Error(`Missing variant: ${p.title} / ${v.title}`);
    if (live && (live.product_id!==p.id || live.title!==v.title || ![v.original_price_cents,v.price_cents].includes(live.price_cents))) throw new Error(`Variant changed: ${p.title} / ${v.title}`);
    if (recorded) {
      if (recorded.variant_id!==v.id || recorded.quantity_delta!==v.stock || recorded.reason!==plan.reason) throw new Error(`Opening ledger mismatch: ${v.id}`);
    } else if (live && live.stock!==0) throw new Error(`Stock is already set for ${p.title} / ${v.title}. Review counts before applying.`);
    if (newIds.has(v.id) && current.some(row=>row.id!==v.id && row.sku===v.sku)) throw new Error(`SKU already in use: ${v.sku}`);
  }
}
console.log(`Preflight passed: ${plan.total_units} opening units; ${plan.products.flatMap(p=>p.variants).length} variants. Prior recorded counts will not be repeated.`);
if (process.argv.includes('--apply')) {
  if (!staple.merch_variants.length) {
    const {error} = await db.rpc('save_merch_product',{payload:{...staple,options:[{name:'Size',values:plan.staple_variants.map(v=>v.title)}],merch_variants:plan.staple_variants}});
    if(error) throw error;
  } else {
    for(const v of plan.staple_variants) if(!staple.merch_variants.some(row=>row.id===v.id && row.sku===v.sku)) throw new Error('Staple tee variants are incomplete or changed; review before applying');
  }
  for (const p of plan.products) for (const v of p.variants) {
    const {data,error} = await db.from('merch_variants').update({price_cents:v.price_cents}).eq('id',v.id).in('price_cents',[v.original_price_cents,v.price_cents]).select('id');
    if(error || data.length!==1) throw new Error(`Price changed while applying ${v.id}; inspect before retrying`);
    if(v.stock>0) {
      const {error} = await db.rpc('adjust_merch_inventory',{variant:v.id,delta:v.stock,reason_text:plan.reason,request_key:v.request_id});
      if(error) throw new Error(`Count interrupted at ${v.id}; retry this same plan: ${error.message}`);
    }
  }
  const {data:after,error} = await db.from('merch_variants').select('id,stock,price_cents');
  if(error) throw error;
  for(const v of plan.products.flatMap(p=>p.variants)) if(after.find(row=>row.id===v.id)?.price_cents!==v.price_cents) throw new Error(`Price verification failed: ${v.id}`);
  console.log(JSON.stringify({appliedOpeningUnits:plan.total_units,currentStockTotal:after.reduce((n,v)=>n+v.stock,0),stapleStillHidden:!staple.active,checkoutBackendUnchanged:true}));
} else console.log('Read-only: add --apply to record the confirmed counts and sale prices.');
