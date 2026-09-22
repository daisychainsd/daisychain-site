import { before, beforeEach, after, test, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import Stripe from "stripe";
import { NextRequest } from "next/server";
import { POST as stripeWebhookRoute } from "../src/app/api/webhooks/stripe/route";
import { normalizeCart, priceCart } from "../src/lib/merch/checkout";
import { pirateShipCsv, canExport } from "../src/lib/merch/csv";
import { currentPaymentBlock, reconcilePhysicalOrders, reconciliationFailed, type ReconciliationDependencies } from "../src/lib/merch/reconcile";
import { runReconciliationCron } from "../src/lib/merch/reconcile-cron";
import { orderPayload } from "../src/lib/merch/orders";
import { capturedPhysicalItems, reconcileLegacyItems } from "../src/lib/merch/legacy";
import { notifyMerchEvent } from "../src/lib/merch/notifications";
import { processMerchEvent, merchWebhookDependencies, type MerchWebhookDependencies } from "../src/lib/merch/webhook";
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
  record: async (payload, deductInventory) => await rpc("record_merch_order", [JSON.stringify(payload), deductInventory]) as { created: boolean },
  block: async (intent, status) => { await rpc("block_merch_payment", [intent, status]); }, physicalIntent: async () => true,
};
before(async () => {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(readFileSync("scripts/merch-schema-2026-09-14.sql", "utf8"));
  await db.exec(readFileSync("scripts/merch-shipping-2026-09-22.sql", "utf8"));
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


test("manual shipped toggle works without tracking and can be undone", async () => {
  await processMerchEvent(event(), dependencies);
  const [o] = await orders();
  await rpc("update_merch_order", [o.id, "shipped", "", "Checked Pirate Ship", false]);
  assert.equal((await orders())[0].fulfillment_status, "shipped");
  assert.ok((await orders())[0].shipped_at);
  await rpc("update_merch_order", [o.id, "new", "", "Checked Pirate Ship", false]);
  assert.equal((await orders())[0].shipped_at, null);
  assert.equal((await orders())[0].fulfillment_status, "new");
});


test("Shopify-era payments enter Ops without catalog mapping or inventory changes", async () => {
  const line = { quantity: 2, amount_subtotal: 8000, description: "Original product name", price: { product: { name: "Renamed product", description: "L" } } } as Stripe.LineItem;
  const legacyItems = capturedPhysicalItems([line]);
  assert.equal(legacyItems[0].title, "Original product name");
  assert.equal(legacyItems[0].variant_title, "L");
  assert.equal(legacyItems[0].variant_id, null);
  const legacy = session({ metadata: { type: "physical", variants: "[]" }, amount_subtotal: 8000, amount_total: 8599 });
  const deps = { ...dependencies, legacyItems: async () => legacyItems };
  await processMerchEvent(event(legacy), deps);
  let [o] = await orders();
  assert.equal(o.fulfillment_status, "new"); assert.equal(o.inventory_issue, false); assert.equal(await stock(), 5);
  await rpc("update_merch_order", [o.id, "shipped", "", "Already mailed", false]);
  await processMerchEvent(event(legacy), deps);
  [o] = await orders();
  assert.equal((await orders()).length, 1); assert.equal(o.fulfillment_status, "shipped"); assert.equal(o.notes, "Already mailed");
});

test("the actual signed webhook records physical orders with MERCH_BACKEND unset, retries failed writes", async () => {
  const previous = { backend: process.env.MERCH_BACKEND, secret: process.env.STRIPE_WEBHOOK_SECRET, stripe: process.env.STRIPE_SECRET_KEY };
  delete process.env.MERCH_BACKEND;
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_fixture";
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
  const legacy = session({ livemode: false, metadata: { type: "physical", variants: "[]" } });
  const payload = JSON.stringify({ ...event(legacy), livemode: false });
  const request = () => new NextRequest("https://example.invalid/api/webhooks/stripe", { method: "POST", body: payload,
    headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_fixture" }) } });
  const itemsMock = mock.method(merchWebhookDependencies, "legacyItems", async () => snapshot);
  const recordMock = mock.method(merchWebhookDependencies, "record", async () => { throw new Error("Database unavailable"); });
  try {
    assert.equal((await stripeWebhookRoute(request())).status, 503);
    recordMock.mock.mockImplementation(dependencies.record);
    assert.equal((await stripeWebhookRoute(request())).status, 200);
    assert.equal((await stripeWebhookRoute(request())).status, 200);
    assert.equal((await orders()).length, 1);
  } finally {
    itemsMock.mock.restore(); recordMock.mock.restore();
    for (const [key, value] of Object.entries({ MERCH_BACKEND: previous.backend, STRIPE_WEBHOOK_SECRET: previous.secret, STRIPE_SECRET_KEY: previous.stripe })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("legacy top-level Stripe shipping addresses survive recovery", () => {
  const current = session();
  const old = { ...current, collected_information: null, shipping_details: current.collected_information?.shipping_details };
  assert.deepEqual(orderPayload(old, snapshot).shipping_address, current.collected_information?.shipping_details?.address);
});


function reconciliationFixture(sessions: Stripe.Checkout.Session[]): ReconciliationDependencies {
  return {
    sessions: async function* () { for (const s of sessions) yield s; },
    items: async () => snapshot,
    find: async (id) => (await orders()).find(o => o.stripe_session_id === id) ?? null,
    paymentBlock: async () => null,
    record: dependencies.record, block: dependencies.block,
    annotate: async (id) => { await db.query("update merch_orders set notes='Recovered fixture: verify Pirate Ship' where stripe_session_id=$1 and notes='' and fulfillment_status='new'", [id]); },
  };
}

test("reconciliation traverses beyond the first page, imports only paid physical orders and replays safely", async () => {
  const digital = Array.from({ length: 101 }, (_, i) => session({ id: `cs_digital_${i}`, metadata: { type: "cart" } }));
  const physical = session({ metadata: { type: "physical" } });
  const deps = reconciliationFixture([...digital, session({ payment_status: "unpaid" }), physical]);
  const { report } = await reconcilePhysicalOrders(true, deps);
  assert.equal(report.checked, 103); assert.equal(report.physical, 1); assert.equal(report.imported, 1);
  const [o] = await orders(); assert.match(o.notes, /Pirate Ship/); assert.equal(await stock(), 5);
  await rpc("update_merch_order", [o.id, "shipped", "", "Already shipped", false]);
  assert.equal((await reconcilePhysicalOrders(true, deps)).report.imported, 0);
  assert.equal((await orders())[0].fulfillment_status, "shipped"); assert.equal((await orders())[0].notes, "Already shipped");
});

test("webhook winning the reconciliation race is not counted or annotated as an import", async () => {
  const deps = reconciliationFixture([session()]);
  deps.find = async () => { await processMerchEvent(event(), dependencies); return null; };
  deps.annotate = async () => assert.fail("The webhook's order must not be annotated");
  const { report } = await reconcilePhysicalOrders(true, deps);
  assert.equal(report.imported, 0); assert.deepEqual(report.failures, []);
  assert.equal((await orders()).length, 1); assert.equal((await orders())[0].notes, ""); assert.equal(await stock(), 3);
});

test("reconciliation holds missing refunded orders and preserves an approved partial refund", async () => {
  const deps = reconciliationFixture([session()]); deps.paymentBlock = async () => "partially_refunded";
  await reconcilePhysicalOrders(true, deps);
  const [o] = await orders(); assert.equal(o.fulfillment_status, "on_hold");
  await rpc("update_merch_order", [o.id, "new", "", "Shipping adjustment reviewed", false]);
  await reconcilePhysicalOrders(true, deps);
  assert.equal((await orders())[0].fulfillment_status, "new");
  deps.paymentBlock = async () => "refunded";
  await reconcilePhysicalOrders(true, deps);
  assert.equal((await orders())[0].fulfillment_status, "on_hold"); assert.equal((await orders())[0].payment_status, "refunded");
});

test("reconciliation reports failures without hiding another paid order and dry-run never writes", async () => {
  const bad = session({ id: "cs_bad" }); const good = session({ id: "cs_good" });
  const deps = reconciliationFixture([bad, good]);
  deps.items = async (s) => { if (s.id === bad.id) throw new Error("Missing Stripe snapshot"); return snapshot; };
  let result = await reconcilePhysicalOrders(false, deps);
  assert.equal((await orders()).length, 0); assert.equal(result.report.failures[0].session, "cs_bad");
  assert.equal(reconciliationFailed(result.report, false), true);
  result = await reconcilePhysicalOrders(true, deps);
  assert.equal(result.report.imported, 1); assert.equal(reconciliationFailed(result.report, true), true);
  assert.equal((await orders())[0].stripe_session_id, "cs_good");
});

test("resolved disputes do not recreate holds while open/lost disputes remain blocked", async () => {
  const charge = { disputed: true, amount_refunded: 0, refunded: false };
  assert.equal(currentPaymentBlock(charge, [{ status: "won" }]), null);
  assert.equal(currentPaymentBlock(charge, [{ status: "warning_closed" }]), null);
  assert.equal(currentPaymentBlock(charge, [{ status: "needs_response" }]), "disputed");
  assert.equal(currentPaymentBlock(charge, [{ status: "lost" }]), "disputed");
  assert.equal(currentPaymentBlock(charge, []), "disputed");
  assert.equal(currentPaymentBlock({ ...charge, amount_refunded: 500, refunded: true }, [{ status: "won" }]), "refunded");
  await processMerchEvent(event(), dependencies);
  const deps = reconciliationFixture([session()]); deps.paymentBlock = async () => currentPaymentBlock(charge, [{ status: "won" }]);
  await reconcilePhysicalOrders(true, deps);
  assert.equal((await orders())[0].payment_status, "paid");
});

test("live physical refunds alert staff; test refunds do not send alerts", async () => {
  const alerts: string[] = [];
  const refund = { id: "evt_refund", type: "charge.refunded", livemode: true, data: { object: { id: "ch_fixture", refunded: true } } } as Stripe.Event;
  const notify = { confirm: async () => assert.fail("A refund must not send a receipt"), alert: async (_: string, message: string) => { alerts.push(message); } };
  await notifyMerchEvent(refund, notify);
  assert.equal(alerts.length, 1); assert.match(alerts[0], /fully refunded/);
  await notifyMerchEvent({ ...refund, livemode: false }, notify); assert.equal(alerts.length, 1);
});

test("cron rejects unauthorized requests and returns retryable failures with distinct alerts", async () => {
  let runs = 0; const keys: string[] = [];
  const report = { checked: 1, physical: 1, missing: [], imported: 0, failures: [{ session: "cs_failed", error: "Write failed" }] };
  const deps = { run: async () => { runs++; return { report, recovered: [] }; }, alert: async (key: string, message: string) => { keys.push(key); assert.match(message, /cs_failed/); } };
  const req = (auth = "") => new Request("https://example.invalid/api/cron/merch-reconcile", { headers: { authorization: auth } });
  assert.equal((await runReconciliationCron(req(), "secret", deps)).status, 401);
  assert.equal((await runReconciliationCron(req("Bearer secret"), "", deps)).status, 401); assert.equal(runs, 0);
  assert.equal((await runReconciliationCron(req("Bearer secret"), "secret", deps)).status, 503);
  report.failures[0].error = "Different failure";
  assert.equal((await runReconciliationCron(req("Bearer secret"), "secret", deps)).status, 503); assert.notEqual(keys[0], keys[1]);
  report.failures = [];
  assert.equal((await runReconciliationCron(req("Bearer secret"), "secret", deps)).status, 200);
});

test("fresh-install schema agrees with the optional-tracking migration", () => {
  const schema = readFileSync("supabase-schema.sql", "utf8");
  const migration = readFileSync("scripts/merch-shipping-2026-09-22.sql", "utf8");
  const body = (s: string) => s.slice(s.indexOf("function public.update_merch_order(")).split("$$;")[0];
  assert.equal(body(schema), body(migration));
});
