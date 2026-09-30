import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { discountedCents, productCompareAtPrice } from "../src/lib/merch/sale";
import { priceCart } from "../src/lib/merch/checkout";
import { selectMerchProducts } from "../src/lib/merch/placement";
import { POST } from "../src/app/api/ops/merch/product/route";
import type { CatalogProduct, MerchProduct } from "../src/lib/merch/types";

const migration = readFileSync("scripts/merch-discounts-2026-09-30.sql", "utf8");
async function database() {
  const db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(readFileSync("scripts/merch-schema-2026-09-14.sql", "utf8"));
  return db;
}
const seed = { id: "p", handle: "black-daisy-chain-recordings-tee", title: "Tee", description: "", product_type: "T-Shirt", active: true, images: [], options: [],
  merch_variants: [{ id: "v", title: "S", sku: "DCM01", price_cents: 2700, active: true, selected_options: [], sort_order: 0 }] };
async function save(db: PGlite, p: unknown) { await db.query("select save_merch_product($1::jsonb)", [JSON.stringify(p)]); }
async function catalog(db: PGlite) {
  return (await db.query<CatalogProduct>("select p.*, (select jsonb_agg(v) from merch_variants v where v.product_id=p.id) as merch_variants from merch_products p where id='p'")).rows[0];
}

test("migration seeds only confirmed offers, preserves checkout and stock, and never reactivates disabled sales on rerun", async () => {
  assert.ok(readFileSync("supabase-schema.sql", "utf8").includes(migration));
  const db = await database();
  try {
    await save(db, seed);
    await db.exec("update merch_variants set stock=7");
    await db.exec(migration);
    let p = await catalog(db);
    assert.equal(p.discount_percent, 40);
    assert.equal(p.merch_variants[0].compare_at_price_cents, 4500);
    assert.equal(priceCart([{variantId:"v",quantity:2}], [p])[0].unit_price_cents, 2700);
    assert.equal(p.merch_variants[0].stock, 7);
    await save(db, {...seed, discount_percent:0, merch_variants:[{...seed.merch_variants[0], regular_price_cents:4500}]});
    await db.exec(migration);
    p = await catalog(db);
    assert.equal(p.discount_percent, 0);
    assert.equal(p.merch_variants[0].price_cents, 4500);
    assert.equal(p.merch_variants[0].compare_at_price_cents, null);
    assert.equal(p.merch_variants[0].stock, 7);
  } finally { await db.close(); }
});

test("saves calculate from regular prices, round cents, preserve stock, reject invalid values and legacy price overwrites atomically", async () => {
  const db = await database();
  try {
    await save(db, seed); await db.exec("update merch_variants set stock=7"); await db.exec(migration);
    const payload = {...seed, discount_percent:25, merch_variants:[{...seed.merch_variants[0],regular_price_cents:4599}]};
    await save(db, payload); await save(db, payload);
    let p = await catalog(db);
    assert.equal(p.merch_variants[0].price_cents, 3449);
    assert.equal(p.merch_variants[0].compare_at_price_cents, 4599);
    assert.equal(p.merch_variants[0].stock, 7);
    // Old live editor can save content using its current price, but not rewrite sale pricing.
    await save(db, {...seed, title:"New title", merch_variants:[{...seed.merch_variants[0],price_cents:3449}]});
    assert.equal((await catalog(db)).discount_percent,25);
    await assert.rejects(save(db,seed),/updated product editor/);
    for (const percent of [null,-1,100,12.5,"40"]) await assert.rejects(save(db,{...payload,discount_percent:percent}));
    await assert.rejects(save(db,{...payload,merch_variants:[{...payload.merch_variants[0],regular_price_cents:1}]}));
    await assert.rejects(save(db,{...payload,merch_variants:[]}),/every existing size/);
    p = await catalog(db);
    assert.equal(p.title,"New title"); assert.equal(p.discount_percent,25);
    assert.equal(p.merch_variants[0].price_cents,3449);
    await db.exec("set role anon");
    await assert.rejects(save(db,payload),/permission denied/);
  } finally { await db.close(); }
});

test("migration skips changed prices instead of inventing a comparison", async () => {
  const db = await database();
  try {
    await save(db,{...seed,merch_variants:[{...seed.merch_variants[0],price_cents:2800}]});
    await db.exec(migration);
    const p=await catalog(db); assert.equal(p.discount_percent,0);assert.equal(p.merch_variants[0].compare_at_price_cents,null);
  } finally { await db.close(); }
});

test("Ops API writes validated regular prices through the real SQL function and checkout uses the saved discount", async () => {
  const db = await database(); const fetchBefore=globalThis.fetch;
  const envBefore={...process.env};
  try {
    await save(db,seed);await db.exec(migration);await db.exec("update merch_variants set stock=7");
    process.env.OPS_PASSWORD="test-password";process.env.NEXT_PUBLIC_SUPABASE_URL="https://fixture.supabase.co";process.env.SUPABASE_SERVICE_ROLE_KEY="test-service-key";
    let writes=0;
    globalThis.fetch=async (input,init)=>{
      assert.equal(String(input),"https://fixture.supabase.co/rest/v1/rpc/save_merch_product");
      writes++;const {payload}=JSON.parse(String(init?.body));await save(db,payload);
      return new Response(null,{status:204});
    };
    const post=(body:unknown)=>POST(new Request("https://example.invalid/api/ops/merch/product",{method:"POST",headers:{authorization:"Basic "+Buffer.from("ops:test-password").toString("base64"),origin:"https://example.invalid","content-type":"application/json"},body:JSON.stringify(body)}));
    const body={...seed,discount_percent:40,merch_variants:[{...seed.merch_variants[0],regular_price_cents:6500}]};
    const result=await post(body);assert.equal(result.status,200,await result.text());
    const p=await catalog(db);assert.equal(p.merch_variants[0].price_cents,3900);assert.equal(p.merch_variants[0].compare_at_price_cents,6500);
    assert.equal(priceCart([{variantId:"v",quantity:1}],[p])[0].unit_price_cents,3900);
    for(const discount_percent of [undefined,null,-1,100,40.5,"40"])assert.equal((await post({...body,discount_percent})).status,400);
    assert.equal((await post({...body,merch_variants:[{...body.merch_variants[0],regular_price_cents:1}]})).status,400);
    const stale=await post({...seed,discount_percent:40});
    assert.equal(stale.status,400);assert.match(await stale.text(),/Reload the product editor/);
    assert.equal(writes,1);
  } finally { globalThis.fetch=fetchBefore;process.env=envBefore;await db.close(); }
});

test("manual placement preserves CMS order and exclusions, skips missing/duplicate IDs, and an empty manual list stays empty",()=>{
  const products=["a","b","c"].map(id=>({id})) as MerchProduct[];
  assert.deepEqual(selectMerchProducts(products,undefined,2).map(p=>p.id),["a","b"]);
  assert.deepEqual(selectMerchProducts(products,{manualSelection:false,products:[]}).map(p=>p.id),["a","b","c"]);
  assert.deepEqual(selectMerchProducts(products,{manualSelection:true,products:[{productId:"c"},{productId:"hidden"},{productId:"a"},{productId:"c"}]}).map(p=>p.id),["c","a"]);
  assert.deepEqual(selectMerchProducts(products,{manualSelection:true,products:[]}),[]);
  assert.equal(discountedCents(4500,40),2700);assert.equal(discountedCents(6500,40),3900);
});


test("grid sale comparisons follow the cheapest size and suppress inconsistent discount data",()=>{
  const product={discountPercent:40,variants:{edges:[
    {node:{price:{amount:"39.00",currencyCode:"USD"},compareAtPrice:{amount:"65.00",currencyCode:"USD"}}},
    {node:{price:{amount:"27.00",currencyCode:"USD"},compareAtPrice:{amount:"45.00",currencyCode:"USD"}}},
  ]}} as MerchProduct;
  assert.equal(productCompareAtPrice(product),45);
  product.variants.edges[0].node.price.amount="40.00";
  assert.equal(productCompareAtPrice(product),undefined);
});
