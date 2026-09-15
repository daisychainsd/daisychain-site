import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type Stripe from "stripe";
import { normalizeCart, priceCart } from "../src/lib/merch/checkout";
import { pirateShipCsv, canExport } from "../src/lib/merch/csv";
import { orderPayload } from "../src/lib/merch/orders";
import { reconcileLegacyItems } from "../src/lib/merch/legacy";
import { notifyMerchEvent } from "../src/lib/merch/notifications";
import { processMerchEvent, type MerchWebhookDependencies } from "../src/lib/merch/webhook";
import type { CatalogProduct, MerchOrder, OrderItem } from "../src/lib/merch/types";
import { POST as exportRoute } from "../src/app/api/ops/merch/export/route";
import { POST as inventoryRoute } from "../src/app/api/ops/merch/inventory/route";
import { POST as orderRoute } from "../src/app/api/ops/merch/order/route";
import { POST as productRoute } from "../src/app/api/ops/merch/product/route";
import { POST as imageRoute } from "../src/app/api/ops/merch/image/route";
import { GET as listRoute } from "../src/app/api/ops/merch/route";

const db = new PGlite();
const snapshot: OrderItem[] = [{ variant_id: "variant-m", title: "Shirt", variant_title: "M", sku: "TEE-M", quantity: 2, unit_price_cents: 2500 }];
function session(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return { id: "cs_live_fixture", created: 1789400000, status: "complete", payment_status: "paid", livemode: true,
    metadata: { type: "physical", merch_checkout_id: "00000000-0000-4000-8000-000000000001" }, payment_intent: "pi_fixture",
    customer_details: { email: "fixture@example.invalid", name: "Fixture Person", phone: "+16195550123" },
    collected_information: { shipping_details: { name: "Fixture Person", address: { line1: "123 Example St", line2: "Apt 4", city: "San Diego", state: "CA", postal_code: "00123", country: "US" } } },
    amount_total: 5599, amount_subtotal: 5000, currency: "usd", total_details: { amount_shipping: 599, amount_tax: 0, amount_discount: 0 }, ...overrides } as Stripe.Checkout.Session;
}
function event(s = session(), type = "checkout.session.completed"): Stripe.Event {
  return { id: "evt_fixture", type, data: { object: s } } as Stripe.Event;
}
async function rpc(name: string, values: unknown[]) {
  const placeholders = values.map((_, i) => `$${i + 1}`).join(",");
  return (await db.query<Record<string, unknown>>(`select ${name}(${placeholders}) as result`, values)).rows[0].result;
}
async function orders() { return (await db.query<MerchOrder>("select * from merch_orders order by order_number")).rows; }
async function stock() { return (await db.query<{ stock: number }>("select stock from merch_variants where id='variant-m'")).rows[0].stock; }
const dependencies: MerchWebhookDependencies = {
  snapshot: async () => snapshot, legacyItems: async () => snapshot,
  record: async (payload) => { await rpc("record_merch_order", [JSON.stringify(payload)]); },
  block: async (intent, status) => { await rpc("block_merch_payment", [intent, status]); }, physicalIntent: async () => true,
};
before(async () => {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(readFileSync("scripts/merch-schema-2026-09-14.sql", "utf8"));
});
beforeEach(async () => {
  await db.exec("reset role; truncate merch_exports, merch_inventory_adjustments, merch_orders, merch_checkouts, merch_payment_blocks, merch_variants, merch_products restart identity cascade;");
  await db.exec("insert into merch_products(id,handle,title) values('product','shirt','Shirt'); insert into merch_variants(id,product_id,title,sku,price_cents,stock) values('variant-m','product','M','TEE-M',2500,5);");
});
after(async () => { await db.close(); });

test("legacy sessions retain size/SKU and match reversed Stripe lines without relying on order", () => {
  const variants = [{ id: "m", title: "M", sku: "TEE-M", merch_products: { title: "Shirt" } }, { id: "l", title: "L", sku: "TEE-L", merch_products: { title: "Shirt" } }];
  const line = (size: string) => ({ quantity: 1, amount_subtotal: 2500, price: { unit_amount: 2500, product: { name: "Shirt", description: size } } }) as Stripe.LineItem;
  const items = reconcileLegacyItems([{ vid: "m", qty: 1 }, { vid: "l", qty: 1 }], [line("L"), line("M")], variants);
  assert.deepEqual(items.map((i) => [i.variant_id, i.variant_title, i.sku]), [["l", "L", "TEE-L"], ["m", "M", "TEE-M"]]);
  assert.throws(() => reconcileLegacyItems([{ vid: "m", qty: 1 }], [line("XS")], variants), /manual variant reconciliation/);
});
test("confirmation and alert outages do not retry an already persisted payment", async () => {
  await processMerchEvent(event(), dependencies);
  const alerts: string[] = [];
  await notifyMerchEvent(event(), { confirm: async () => { throw new Error("Recipient suppressed"); }, alert: async (_, message) => { alerts.push(message); throw new Error("Email provider down"); } });
  assert.equal((await orders()).length, 1); assert.equal(await stock(), 3);
  assert.match(alerts[0], /was saved/);
});
test("physical disputes alert even for an older order missing from Merch Ops", async () => {
  const dispute = { id: "evt_dispute", type: "charge.dispute.created", livemode: true, data: { object: { id: "dp_fixture", payment_intent: "pi_old" } } } as Stripe.Event;
  assert.equal(await processMerchEvent(dispute, dependencies), true);
  assert.equal((await orders()).length, 0);
  const alerts: string[] = [];
  await notifyMerchEvent(dispute, { confirm: async () => assert.fail("No receipt on dispute"), alert: async (_, message) => { alerts.push(message); } });
  assert.match(alerts[0], /dp_fixture/);
  await notifyMerchEvent({ ...dispute, livemode: false }, { confirm: async () => {}, alert: async () => assert.fail("Test dispute must not email") });
});

test("paid webhooks persist an order and decrement inventory once across repeated/session events", async () => {
  await Promise.all([processMerchEvent(event(), dependencies), processMerchEvent(event(), dependencies)]);
  await processMerchEvent(event(session(), "checkout.session.async_payment_succeeded"), dependencies);
  assert.equal((await orders()).length, 1); assert.equal(await stock(), 3);
  assert.equal((await db.query("select * from merch_inventory_adjustments")).rows.length, 1);
});
test("failed transaction rolls back order and inventory, then the same session retries successfully", async () => {
  await db.exec("create function reject_ledger() returns trigger language plpgsql as $$ begin raise exception 'fixture failure'; end $$; create trigger reject_ledger before insert on merch_inventory_adjustments for each row execute function reject_ledger();");
  await assert.rejects(processMerchEvent(event(), dependencies), /fixture failure/);
  assert.equal((await orders()).length, 0); assert.equal(await stock(), 5);
  await db.exec("drop trigger reject_ledger on merch_inventory_adjustments; drop function reject_ledger();");
  await processMerchEvent(event(), dependencies);
  assert.equal((await orders()).length, 1); assert.equal(await stock(), 3);
});
test("unpaid and unrelated digital events never create a merch order", async () => {
  await processMerchEvent(event(session({ payment_status: "unpaid" })), dependencies);
  assert.equal(await processMerchEvent(event(session({ metadata: { type: "cart" } })), dependencies), false);
  assert.equal((await orders()).length, 0);
});
test("test orders do not consume stock or enter shipping exports", async () => {
  await processMerchEvent(event(session({ livemode: false })), dependencies);
  const [o] = await orders(); assert.equal(await stock(), 5); assert.equal(canExport(o), false);
  await assert.rejects(rpc("export_merch_orders", [[o.id], crypto.randomUUID(), false]), /cannot be exported/);
});
test("out-of-order full refund blocks a future order and cannot be downgraded by a later partial refund", async () => {
  await rpc("block_merch_payment", ["pi_fixture", "refunded"]);
  await processMerchEvent(event(), dependencies);
  await rpc("block_merch_payment", ["pi_fixture", "partially_refunded"]);
  const [o] = await orders(); assert.equal(o.payment_status, "refunded"); assert.equal(o.fulfillment_status, "on_hold");
  await assert.rejects(rpc("update_merch_order", [o.id, "new", "", "", false]), /must remain on hold/);
});
test("partial refund holds an order; staff can explicitly approve it to ship", async () => {
  await processMerchEvent(event(), dependencies);
  await rpc("block_merch_payment", ["pi_fixture", "partially_refunded"]);
  let [o] = await orders(); assert.equal(canExport(o), false);
  await rpc("update_merch_order", [o.id, "new", "", "Shipping overcharge refunded; items still ship", false]);
  [o] = await orders(); assert.equal(canExport(o), true);
});
test("stock shortage preserves paid order but blocks shipping until a counted correction", async () => {
  await db.exec("update merch_variants set stock=1;");
  await processMerchEvent(event(), dependencies);
  let [o] = await orders(); assert.equal(o.inventory_issue, true); assert.equal(await stock(), -1);
  await assert.rejects(rpc("update_merch_order", [o.id, "new", "", "Found additional stock", true]), /Correct missing/);
  await rpc("adjust_merch_inventory", ["variant-m", 2, "Counted stock", crypto.randomUUID()]);
  await rpc("update_merch_order", [o.id, "new", "", "Counted replacement stock", true]);
  [o] = await orders(); assert.equal(canExport(o), true);
});
test("missing legacy variant cannot silently ship or decrement a different item", async () => {
  await rpc("record_merch_order", [JSON.stringify(orderPayload(session(), [{ ...snapshot[0], variant_id: "missing" }]))]);
  const [o] = await orders(); assert.equal(o.inventory_issue, true); assert.equal(await stock(), 5);
});
test("manual booth adjustments are idempotent and cannot oversell", async () => {
  const key = crypto.randomUUID();
  await rpc("adjust_merch_inventory", ["variant-m", -3, "Booth sales", key]);
  await rpc("adjust_merch_inventory", ["variant-m", -3, "Booth sales", key]);
  assert.equal(await stock(), 2);
  await assert.rejects(rpc("adjust_merch_inventory", ["variant-m", -3, "Booth sales", crypto.randomUUID()]), /negative/);
  await assert.rejects(rpc("adjust_merch_inventory", ["variant-m", 2, "Different action", key]), /already used/);
});
test("catalog import preserves tags and repeated product saves never overwrite stock", async () => {
  const product = { id: "product", handle: "shirt", title: "Shirt", description: "Merch", product_type: "Shirt", active: true, images: [], options: [], tags: ["featured"],
    merch_variants: [{ id: "variant-m", title: "M", sku: "TEE-M", price_cents: 2500, active: true, selected_options: [], sort_order: 0, stock: 999 }] };
  await rpc("save_merch_product", [JSON.stringify(product)]);
  const { tags: _tags, ...edit } = product;
  await rpc("save_merch_product", [JSON.stringify({ ...edit, title: "Updated shirt" })]);
  assert.equal(await stock(), 5);
  assert.deepEqual((await db.query<{ tags: string[] }>("select tags from merch_products where id='product'")).rows[0].tags, ["featured"]);
});
test("export is atomic, retryable and distinct from re-export/shipping", async () => {
  await processMerchEvent(event(), dependencies); const [o] = await orders(); const key = crypto.randomUUID();
  await rpc("export_merch_orders", [[o.id], key, false]); await rpc("export_merch_orders", [[o.id], key, false]);
  assert.equal((await orders())[0].fulfillment_status, "exported");
  await assert.rejects(rpc("export_merch_orders", [[o.id], crypto.randomUUID(), false]), /cannot be exported/);
  await rpc("export_merch_orders", [[o.id], crypto.randomUUID(), true]);
  await rpc("update_merch_order", [o.id, "shipped", "TRACK-FIXTURE", "", false]);
  await assert.rejects(rpc("export_merch_orders", [[o.id], crypto.randomUUID(), true]), /cannot be exported/);
});
test("a mixed eligible/refunded export rolls back all export markers", async () => {
  await processMerchEvent(event(), dependencies);
  await processMerchEvent(event(session({id:"cs_second",payment_intent:"pi_second"})), dependencies);
  await rpc("block_merch_payment", ["pi_second", "refunded"]);
  const all = await orders();
  await assert.rejects(rpc("export_merch_orders", [all.map(o => o.id), crypto.randomUUID(), false]), /cannot be exported/);
  assert.equal((await orders())[0].exported_at, null);
});
test("anon and authenticated cannot read customer data, stock or invoke transactions", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role};`);
    for (const table of ["merch_orders", "merch_variants", "merch_inventory_adjustments", "merch_checkouts", "merch_exports"]) await assert.rejects(db.query(`select * from ${table}`), /permission denied/);
    await assert.rejects(rpc("record_merch_order", [JSON.stringify(orderPayload(session(), snapshot))]), /permission denied/);
    await db.exec("reset role;");
  }
  await db.exec("set role service_role;");
  await processMerchEvent(event(), dependencies);
  assert.equal((await orders()).length, 1);
  await db.exec("reset role;");
});
test("server pricing ignores forged prices and merges duplicate quantities before stock validation", () => {
  const product = { id:"product",title:"Shirt",active:true,merch_variants:[{id:"variant-m",title:"M",sku:"TEE-M",active:true,currency:"usd",price_cents:2500,stock:3}] } as CatalogProduct;
  const requested = normalizeCart([{ variantId:"variant-m",quantity:2,price:0.01 }]);
  assert.equal(priceCart(requested, [product])[0].unit_price_cents, 2500);
  assert.throws(() => priceCart(normalizeCart([...requested,...requested]), [product]), /Only 3/);
  assert.throws(() => normalizeCart([{variantId:"variant-m",quantity:-1}]), /Invalid/);
  assert.throws(() => normalizeCart([{variantId:"variant-m",quantity:10},{variantId:"variant-m",quantity:1}]), /Maximum/);
  assert.throws(() => orderPayload(session({amount_subtotal:1}), snapshot), /does not match/);
});
test("CSV contains one shipment row and preserves phone, postal code, Unicode and quoting", async () => {
  await processMerchEvent(event(), dependencies); const [o] = await orders();
  const csv = pirateShipCsv([{...o,customer_name:'José "Fixture", Jr.'}]);
  assert.ok(csv.includes('"+16195550123"')); assert.ok(csv.includes('"00123"')); assert.ok(csv.includes('"José ""Fixture"", Jr."'));
  assert.equal(csv.split("\r\n").filter(Boolean).length, 2);
  assert.ok(pirateShipCsv([{...o,customer_name:'=HYPERLINK("bad")'}]).includes("'=HYPERLINK"));
});
test("actual Ops routes reject unauthenticated and cross-origin requests before DB access", async () => {
  process.env.OPS_PASSWORD = "fixture-password";
  const auth = "Basic " + Buffer.from("staff:fixture-password").toString("base64");
  for (const route of [exportRoute, inventoryRoute, orderRoute, productRoute, imageRoute]) {
    assert.equal((await route(new Request("https://example.invalid/api/ops/merch", {method:"POST"}))).status, 401);
    assert.equal((await route(new Request("https://example.invalid/api/ops/merch", {method:"POST",headers:{authorization:auth,origin:"https://attacker.invalid"}}))).status, 403);
  }
  assert.equal((await listRoute(new Request("https://example.invalid/api/ops/merch"))).status, 401);
  delete process.env.OPS_PASSWORD;
  assert.equal((await listRoute(new Request("https://example.invalid/api/ops/merch"))).status, 404);
});
