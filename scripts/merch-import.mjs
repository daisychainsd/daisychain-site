// Dry run: node --env-file=.env.local scripts/merch-import.mjs
// Apply the reviewed snapshot: node --env-file=.env.local scripts/merch-import.mjs --apply
// This imports catalog data/images ONLY. Opening stock is entered in Ops after a physical count.
import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = path.resolve('.merch-import');
const apply = process.argv.includes('--apply');
await mkdir(root, { recursive: true });
if (!apply) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  if (!domain || !token) throw new Error('Shopify Storefront configuration missing');
  const products = []; let cursor = null;
  do {
    const query = `query($cursor: String) { products(first: 50, after: $cursor) { pageInfo { hasNextPage endCursor } nodes {
      id handle title description productType tags options { name values }
      images(first: 100) { pageInfo { hasNextPage } nodes { url altText width height } }
      variants(first: 100) { pageInfo { hasNextPage } nodes { id title sku price { amount currencyCode } selectedOptions { name value } } }
    } } }`;
    const response = await fetch(`https://${domain}/api/2026-07/graphql.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token }, body: JSON.stringify({ query, variables: { cursor } }) });
    const body = await response.json();
    if (!response.ok || body.errors) throw new Error(`Shopify export failed: ${response.status}; check Storefront permissions/API version`);
    for (const p of body.data.products.nodes) {
      if (p.variants.pageInfo.hasNextPage || p.images.pageInfo.hasNextPage) throw new Error(`Product ${p.handle} exceeds 100 variants/images; export it separately before continuing`);
      const images = [];
      for (const image of p.images.nodes) {
        const url = new URL(image.url);
        if (url.protocol !== 'https:' || url.hostname !== 'cdn.shopify.com') throw new Error('Unexpected product image host');
        url.searchParams.set('width', '2000');
        const response = await fetch(url, { redirect: 'error' });
        if (!response.ok) throw new Error(`Image download failed for ${p.handle}`);
        const contentType = response.headers.get('content-type')?.split(';')[0];
        const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[contentType];
        if (!extension) throw new Error(`Unsupported image format for ${p.handle}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length > 10000000) throw new Error(`Image exceeds 10 MB for ${p.handle}`);
        const file = `${createHash('sha256').update(bytes).digest('hex')}.${extension}`;
        await writeFile(path.join(root, file), bytes);
        images.push({ ...image, file, contentType });
      }
      products.push({ id: p.id, handle: p.handle, title: p.title, description: p.description, product_type: p.productType, active: true, images, options: p.options, tags: p.tags,
        merch_variants: p.variants.nodes.map((v, i) => {
          const cents = Math.round(Number(v.price.amount) * 100);
          if (v.price.currencyCode !== 'USD' || !Number.isSafeInteger(cents) || cents < 1) throw new Error(`Invalid/non-USD price: ${p.handle}`);
          return { id: v.id, title: v.title, sku: v.sku ?? '', price_cents: cents, active: true, sort_order: i, selected_options: v.selectedOptions };
        }) });
    }
    cursor = body.data.products.pageInfo.hasNextPage ? body.data.products.pageInfo.endCursor : null;
  } while (cursor);
  await writeFile(path.join(root, 'catalog.json'), JSON.stringify(products, null, 2));
  console.log(`DRY RUN: saved ${products.length} products and image files in .merch-import/. No Supabase changes. Opening stock will be zero until counted in Ops.`);
} else {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase configuration missing');
  const products = JSON.parse(await readFile(path.join(root, 'catalog.json'), 'utf8'));
  if (!Array.isArray(products) || !products.length) throw new Error('Run a successful dry run first');
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const p of products) {
    const images = [];
    for (const image of p.images) {
      if (!/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(image.file)) throw new Error('Invalid import image filename');
      const bytes = await readFile(path.join(root, image.file));
      if (!image.file.startsWith(createHash('sha256').update(bytes).digest('hex'))) throw new Error('Import image checksum mismatch');
      const { error } = await db.storage.from('merch-images').upload(image.file, bytes, { contentType: image.contentType, upsert: false });
      if (error && error.statusCode !== '409' && error.statusCode !== '400') throw new Error(error.message);
      // Verify ownership path resolves before switching the product off its old CDN URL.
      const url = db.storage.from('merch-images').getPublicUrl(image.file).data.publicUrl;
      const check = await fetch(url, { method: 'HEAD' });
      if (!check.ok) throw new Error(`Imported image is not readable for ${p.handle}`);
      images.push({ url, altText: image.altText, width: image.width, height: image.height });
    }
    const { error } = await db.rpc('save_merch_product', { payload: { ...p, images } });
    if (error) throw new Error(`Import failed for ${p.handle}: ${error.message}`);
    console.log(`Imported ${p.handle}. Existing stock preserved; new variants start at zero.`);
  }
  console.log('Import complete. Count stock in Ops, verify products/images, then enable MERCH_BACKEND=supabase.');
}
