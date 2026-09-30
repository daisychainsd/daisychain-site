// Offline preview of the actual dashboard. Saves are simulated; no live services are used.
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const imported = JSON.parse(await readFile('.merch-import/catalog.json', 'utf8'));
const plan = JSON.parse(await readFile('.merch-import/sku-photo-update.json', 'utf8'));
const products = await Promise.all(imported.map(async p => ({ ...p,
  images: p.images.length ? [{ ...p.images[0], url: `data:${p.images[0].contentType};base64,${(await readFile(path.join('.merch-import', p.images[0].file))).toString('base64')}` }] : [],
  merch_variants: p.merch_variants.map(v => ({ ...v, product_id: p.id, currency: 'usd', stock: 0, sku: plan.skus.find(s => s.id === v.id).sku })),
})));
const tee = JSON.parse(await readFile('.merch-import/dc-staple-tee-draft.json', 'utf8'));
tee.images = [{ url: `data:image/png;base64,${(await readFile(plan.photo.path)).toString('base64')}`, altText: 'DC staple tee', width: plan.photo.width, height: plan.photo.height }];
products.unshift(tee);
const opening = JSON.parse(await readFile('.merch-import/opening-stock-plan.json', 'utf8'));
tee.merch_variants = opening.staple_variants;
tee.options = [{name:'Size',values:tee.merch_variants.map(v=>v.title)}];
for (const p of products) {
  const planned = opening.products.find(row => row.id === p.id);
  p.merch_variants = p.merch_variants.map(v => {
    const target = planned.variants.find(row => row.id === v.id);
    return { ...v, stock: target.stock, price_cents: target.price_cents, sku: target.sku };
  });
}
const result = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Dashboard from './src/app/ops/merch/MerchDashboard'; createRoot(document.getElementById('root')).render(<Dashboard />);`, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, outfile: '.merch-import/preview.js', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'offline-link', setup(build) { build.onResolve({filter:/^next\/link$/}, () => ({path:'link',namespace:'preview'})); build.onLoad({filter:/.*/,namespace:'preview'}, () => ({contents:`import React from 'react'; export default function Link(props) { return React.createElement('a',props); }`, resolveDir:root,loader:'js'})); } }] });
const js = result.outputFiles.find(f => f.path.endsWith('.js')).text;
const css = result.outputFiles.find(f => f.path.endsWith('.css')).text;
await writeFile('.merch-import/preview-bundle.js', js);
await writeFile('.merch-import/preview-bundle.css', css);
const globalCss = await readFile('.next/dev/static/chunks/src_app_globals_css_1igg3k2._.single.css', 'utf8');
const seed = JSON.stringify({orders:[],products,adjustments:[],newOrders:0}).replaceAll('<','\\u003c');
const fakeApi = `const data=${seed}; const applied=new Map(); window.fetch=async (url,options={})=>{ let body=options.body ? JSON.parse(options.body) : null; if(String(url).endsWith('/inventory')) { const v=data.products.flatMap(p=>p.merch_variants).find(v=>v.id===body.variantId); if(!applied.has(body.requestId)){v.stock+=body.delta;applied.set(body.requestId,true);} return {ok:true,json:async()=>({stock:v.stock})}; } if(String(url).endsWith('/product')) {const index=data.products.findIndex(p=>p.id===body.id);if(index>=0)data.products[index]=body;else data.products.push(body);return {ok:true,json:async()=>({ok:true})};}return {ok:true,json:async()=>structuredClone(data)}; }; window.addEventListener('load',()=>{const timer=setInterval(()=>{const button=[...document.querySelectorAll('nav button')].find(b=>b.textContent==='Inventory');if(button){button.click();clearInterval(timer)}},50)});`;
const output = '/Users/pd/Downloads/Daisy-Chain-product-editor-preview.html';
await writeFile(output, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Daisy Chain — product editor preview</title><style>${globalCss.replace(/@import[^;]+;/g,'')}${css}body{margin:0;background:var(--color-bg-deep);color:var(--color-text-primary);font-family:Helvetica,Arial,sans-serif}.preview-note{padding:14px 24px;background:var(--color-bg-raised);color:var(--color-blue-300);font-size:13px;border-bottom:1px solid var(--border)}</style></head><body><div class="preview-note">PREVIEW · Your confirmed stock: 384 units. The three sale products include 40% off. Saves stay in this preview and never change the live shop. Reload to reset.</div><div id="root"></div><script>${fakeApi}</script><script>${js.replaceAll('</script','<\\/script')}</script></body></html>`);
console.log(output);
