// Prepare from the September 29 local import: node scripts/prepare-merch-catalog-update.mjs
// Apply only the reviewed SKU/photo changes: node --env-file=.env.local scripts/prepare-merch-catalog-update.mjs --apply
// Never changes inventory, price, visibility, orders or the storefront backend.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const root = '.merch-import';
const planFile = `${root}/sku-photo-update.json`;
if (!process.argv.includes('--apply')) {
  const products = JSON.parse(await readFile(`${root}/catalog.json`, 'utf8'));
  let n = 0;
  const skus = products.flatMap(p => [...p.merch_variants].sort((a, b) => a.sort_order - b.sort_order).map(v => ({ id: v.id, product: p.title, variant: v.title, previousSku: v.sku, sku: `DCM${String(++n).padStart(2, '0')}` })));
  const imagePath = process.argv.find(a => a.startsWith('--image='))?.slice(8);
  if (!imagePath) throw new Error('Supply --image=/path/to/replacement.png');
  const bytes = await readFile(imagePath);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Expected a PNG');
  const photo = { productId: 'merch-product-dc-staple-tee', path: imagePath, sha256: createHash('sha256').update(bytes).digest('hex'), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  await writeFile(planFile, JSON.stringify({ skus, photo }, null, 2) + '\n');
  console.log(`Prepared ${skus.length} sequential variant SKUs and replacement photo. No live writes. Plan: ${planFile}`);
} else {
  const plan = JSON.parse(await readFile(planFile, 'utf8'));
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: variants, error } = await db.from('merch_variants').select('id,sku');
  if (error) throw error;
  for (const row of plan.skus) {
    const current = variants.find(v => v.id === row.id);
    if (!current || ![row.previousSku, row.sku].includes(current.sku)) throw new Error(`Catalog changed for ${row.product} / ${row.variant}; prepare a fresh review`);
    if (variants.some(v => v.id !== row.id && v.sku === row.sku)) throw new Error(`SKU ${row.sku} already belongs to another variant`);
  }
  const bytes = await readFile(plan.photo.path);
  if (createHash('sha256').update(bytes).digest('hex') !== plan.photo.sha256) throw new Error('Replacement image changed since review');
  const file = `dc-staple-tee-${plan.photo.sha256}.png`;
  const bucket = db.storage.from('merch-images');
  const { error: uploadError } = await bucket.upload(file, bytes, { contentType: 'image/png', upsert: false });
  if (uploadError && !['400','409'].includes(uploadError.statusCode)) throw uploadError;
  const url = bucket.getPublicUrl(file).data.publicUrl;
  const image = await fetch(url);
  if (!image.ok || !bytes.equals(Buffer.from(await image.arrayBuffer()))) throw new Error('Uploaded image verification failed');
  for (const row of plan.skus) {
    if (variants.find(v => v.id === row.id).sku === row.sku) continue;
    const { data, error } = await db.from('merch_variants').update({ sku: row.sku }).eq('id', row.id).eq('sku', row.previousSku).select('id');
    if (error || data.length !== 1) throw new Error(`SKU update interrupted at ${row.sku}; inspect and retry the same plan`);
  }
  const { data, error: photoError } = await db.from('merch_products').update({ images: [{ url, width: plan.photo.width, height: plan.photo.height, altText: 'DC staple tee — faded black with white Daisy Chain San Diego print' }] }).eq('id', plan.photo.productId).select('id');
  if (photoError || data.length !== 1) throw new Error('Photo update failed; inspect and retry the same plan');
  console.log(`Applied ${plan.skus.length} SKUs and replacement photo. Inventory, prices and visibility unchanged.`);
}
