import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { normalizeBandcampOrders, reconcileBandcampOrders, fetchBandcampOrders, type BandcampFeed, type BandcampDependencies } from "../src/lib/merch/bandcamp";
import { runBandcampCron } from "../src/lib/merch/bandcamp-cron";
import { POST as reviewRoute } from "../src/app/api/ops/merch/bandcamp-review/route";
import { canExport, pirateShipCsv } from "../src/lib/merch/csv";
import type { MerchOrder } from "../src/lib/merch/types";

const db = new PGlite();
const migration = readFileSync("scripts/merch-bandcamp-2026-09-22.sql", "utf8");
function row(overrides: Record<string, unknown> = {}) {
  return { sale_item_id: 101, payment_id: 1001, order_date: "11 Nov 2025 18:19:57 GMT", ship_date: null,
    buyer_email: "fixture@example.invalid", ship_to_name: "Fixture Recipient", ship_to_street: "123 Example St", ship_to_street_2: null,
    ship_to_city: "San Diego", ship_to_state: "CA", ship_to_zip: "00123", ship_to_country_code: "US", ship_to_phone: "+15550000000",
    item_name: "Vinyl with digital download", quantity: 1, sub_total: 40, shipping: 8, tax: 3.96, order_total: 51.96,
    currency: "USD", payment_state: "paid", sku: "VINYL", ...overrides };
}
const feed = (items: Record<string, unknown>[] = [row()]): BandcampFeed => ({ source: "bandcamp", bandId: 123, items });
async function rpc(name: string, args: unknown[]) {
  return (await db.query<{ result: unknown }>(`select ${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`, args)).rows[0].result;
}
async function orders() { return (await db.query<MerchOrder>("select * from merch_orders order by order_number")).rows; }
function deps(data = feed()): BandcampDependencies {
  return { fetch: async () => data, existing: async () => (await orders()).flatMap(o => o.source_order_id ? [o.source_order_id] : []),
    record: async payload => await rpc("record_bandcamp_order", [JSON.stringify(payload)]) as { created: boolean; review_needed?: boolean } };
}
before(async () => {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(readFileSync("scripts/merch-schema-2026-09-14.sql", "utf8"));
  await db.exec(readFileSync("scripts/merch-shipping-2026-09-22.sql", "utf8"));
  await db.exec(migration); await db.exec(migration);
});
beforeEach(async () => { await db.exec("reset role; truncate merch_orders,merch_exports,merch_inventory_adjustments restart identity cascade;"); });
after(async () => { await db.close(); });

test("Bandcamp physical feed groups purchased items, excludes sales-report data, preserves cents and address", () => {
  const result = normalizeBandcampOrders(feed([row(), row({ sale_item_id: 102, quantity: 3, sub_total: 20.69, tax: 2.19, shipping: 5, order_total: 27.880000000000003, item_name: "CD", option: "Deluxe" })]));
  assert.deepEqual(result.failures, []); assert.equal(result.orders.length, 1);
  const o = result.orders[0];
  assert.equal(o.total_cents, 7984); assert.equal(o.items[1].line_total_cents, 2069);
  assert.equal(o.items[1].quantity, 3); assert.equal(o.items[1].variant_title, "Deluxe");
  assert.equal(o.shipping_address.postal_code, "00123"); assert.equal(o.fulfillment_status, "new");
  assert.throws(() => normalizeBandcampOrders({ report: [{ item_type: "track" }] } as unknown as BandcampFeed), /physical merchandise/);
  assert.throws(() => normalizeBandcampOrders(feed([{ bandcamp_transaction_id: 123, item_type: "track" }])), /Invalid Bandcamp ID/);
});
test("physical orders import once, grouped by payment, without Stripe IDs or stock adjustments", async () => {
  const d = deps(feed([row(), row({ sale_item_id: 102 })]));
  const first = await reconcileBandcampOrders(true, d);
  assert.equal(first.report.imported, 1); assert.equal((await orders())[0].items.length, 2);
  assert.equal((await orders())[0].stripe_session_id, null);
  assert.equal((await orders())[0].source, "bandcamp");
  const again = await reconcileBandcampOrders(true, d);
  assert.equal(again.report.imported, 0); assert.deepEqual(again.report.missing, []);
  assert.equal((await db.query("select * from merch_inventory_adjustments")).rows.length, 0);
});
test("shipped backlog retains source date, then manual unshipped/notes/tracking survive resync", async () => {
  const d = deps(feed([row({ ship_date: "06 Mar 2026 21:41:02 GMT" })]));
  await reconcileBandcampOrders(true, d);
  const o = (await orders())[0]; assert.equal(o.fulfillment_status, "shipped");
  assert.equal(new Date(o.shipped_at!).toISOString(), "2026-03-06T21:41:02.000Z");
  await rpc("update_merch_order", [o.id, "new", "TRACK-FIXTURE", "I checked Pirate Ship", false]);
  await reconcileBandcampOrders(true, d);
  const changed = (await orders())[0];
  assert.equal(changed.fulfillment_status, "new"); assert.equal(changed.shipped_at, null);
  assert.equal(changed.notes, "I checked Pirate Ship"); assert.equal(changed.tracking_number, "TRACK-FIXTURE");
  assert.equal(canExport(changed), true);
  const csv = pirateShipCsv([changed]); assert.match(csv, /DC-00001/); assert.match(csv, /00123/);
});
test("manual shipped state is not cleared by Bandcamp's older unshipped state", async () => {
  const d = deps(); await reconcileBandcampOrders(true, d);
  await rpc("update_merch_order", [(await orders())[0].id, "shipped", "", "Manual", false]);
  const before = (await orders())[0]; await reconcileBandcampOrders(true, d);
  assert.deepEqual((await orders())[0], { ...before, source_data: { ...before.source_data, review_needed: false } });
});
test("partial shipping is held rather than exporting already shipped items", async () => {
  await reconcileBandcampOrders(true, deps(feed([row({ ship_date: "06 Mar 2026 21:41:02 GMT" }), row({ sale_item_id: 102 })])));
  const o = (await orders())[0]; assert.equal(o.fulfillment_status, "on_hold"); assert.equal(canExport(o), false);
  assert.match(o.notes, /Partially shipped/);
});
test("pending, failed and refunded orders are visible but cannot ship or export", async () => {
  for (const [index, state] of ["pending", "failed", "refunded"].entries()) {
    await reconcileBandcampOrders(true, deps(feed([row({ payment_id: 1000 + index, payment_state: state })])));
  }
  for (const o of await orders()) {
    assert.equal(o.fulfillment_status, "on_hold"); assert.equal(canExport(o), false);
    await assert.rejects(rpc("update_merch_order", [o.id, "shipped", "", "", false]), /unpaid orders/);
    await assert.rejects(rpc("export_merch_orders", [[o.id], crypto.randomUUID(), false]), /cannot be exported/);
  }
});
test("later refund places an unshipped order on hold while preserving manual notes", async () => {
  await reconcileBandcampOrders(true, deps());
  await rpc("update_merch_order", [(await orders())[0].id, "new", "", "Pack tomorrow", false]);
  await reconcileBandcampOrders(true, deps(feed([row({ payment_state: "refunded" })])));
  const o = (await orders())[0]; assert.equal(o.payment_status, "refunded"); assert.equal(o.fulfillment_status, "on_hold"); assert.equal(o.notes, "Pack tomorrow");
});
test("snapshot change updates refund block and reports review without overwriting shipping address", async () => {
  await reconcileBandcampOrders(true, deps());
  const changed = await reconcileBandcampOrders(true, deps(feed([row({ ship_to_street: "456 New St", payment_state: "refunded" })])));
  assert.equal(changed.report.failures.length, 1);
  const o = (await orders())[0]; assert.equal(o.shipping_address.line1, "123 Example St"); assert.equal(o.payment_status, "refunded");
  assert.equal(o.source_data?.review_needed, true); assert.equal(canExport(o), false);
});
test("later Bandcamp shipments update untouched orders, while explicit manual decisions win", async () => {
  await reconcileBandcampOrders(true, deps());
  const shippedFeed = feed([row({ ship_date: "06 Mar 2026 21:41:02 GMT" })]);
  await reconcileBandcampOrders(true, deps(shippedFeed));
  let o = (await orders())[0]; assert.equal(o.fulfillment_status, "shipped");
  await rpc("update_merch_order", [o.id, "new", "", "Manual review", false]);
  await reconcileBandcampOrders(true, deps(feed([row({ ship_date: "07 Mar 2026 21:41:02 GMT" })])));
  o = (await orders())[0]; assert.equal(o.fulfillment_status, "new"); assert.equal(o.fulfillment_manually_updated, true);
});
test("Ops can accept the reviewed Bandcamp snapshot, with stale-review protection and idempotent retry", async () => {
  await reconcileBandcampOrders(true, deps());
  const changedFeed = feed([row({ ship_to_street: "456 New St", buyer_email: "corrected@example.invalid", ship_to_phone: "+15551111111" })]);
  await reconcileBandcampOrders(true, deps(changedFeed));
  let o = (await orders())[0]; const pending = o.source_data?.pending;
  await assert.rejects(rpc("accept_bandcamp_order", [o.id, "Reviewed", JSON.stringify({ ...pending, customer_name: "Stale view" })]), /changed again/);
  await rpc("accept_bandcamp_order", [o.id, "Checked the corrected address and label", JSON.stringify(pending)]);
  await rpc("accept_bandcamp_order", [o.id, "Checked the corrected address and label", JSON.stringify(pending)]);
  o = (await orders())[0]; assert.equal(o.shipping_address.line1, "456 New St"); assert.equal(o.fulfillment_status, "on_hold");
  assert.equal(o.email, "corrected@example.invalid"); assert.equal(o.phone, "+15551111111");
  assert.equal(o.source_data?.review_needed, false); assert.equal(o.notes.split("Bandcamp details reviewed:").length, 2);
  const replay = await reconcileBandcampOrders(true, deps(changedFeed)); assert.deepEqual(replay.report.failures, []);
  await rpc("update_merch_order", [o.id, "new", "", o.notes, false]); assert.equal(canExport((await orders())[0]), true);
});
test("export RPC checks the Bandcamp review flag and review route rejects cross-origin writes", async () => {
  await reconcileBandcampOrders(true, deps()); const o = (await orders())[0];
  await db.query("update merch_orders set source_data=source_data || '{\"review_needed\":true}'::jsonb where id=$1", [o.id]);
  await assert.rejects(rpc("export_merch_orders", [[o.id], crypto.randomUUID(), false]), /cannot be exported/);
  const old = process.env.OPS_PASSWORD; process.env.OPS_PASSWORD = "fixture-secret";
  try {
    assert.equal((await reviewRoute(new Request("https://fixture.invalid/api/ops/merch/bandcamp-review", { method: "POST" }))).status, 401);
    assert.equal((await reviewRoute(new Request("https://fixture.invalid/api/ops/merch/bandcamp-review", { method: "POST", headers: { Authorization: `Basic ${Buffer.from("staff:fixture-secret").toString("base64")}`, Origin: "https://other.invalid" } }))).status, 403);
  } finally { if (old === undefined) delete process.env.OPS_PASSWORD; else process.env.OPS_PASSWORD = old; }
});
test("dry-run is read-only and mixed valid/invalid orders report failure without losing valid order", async () => {
  const data = feed([row(), row({ payment_id: 1002, sale_item_id: 102, quantity: 0 })]);
  const audit = await reconcileBandcampOrders(false, deps(data));
  assert.equal(audit.report.failures.length, 1); assert.equal(audit.report.missing.length, 1); assert.equal((await orders()).length, 0);
  const applied = await reconcileBandcampOrders(true, deps(data)); assert.equal(applied.report.imported, 1); assert.equal(applied.report.failures.length, 1);
});
test("migration is rerunnable and public roles cannot insert Bandcamp orders or read addresses", async () => {
  await reconcileBandcampOrders(true, deps()); const before = await orders();
  await db.exec(migration); assert.deepEqual(await orders(), before);
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(rpc("record_bandcamp_order", [JSON.stringify(normalizeBandcampOrders(feed()).orders[0])]), /permission denied/);
    await assert.rejects(db.query("select * from merch_orders"), /permission denied/);
    await assert.rejects(rpc("accept_bandcamp_order", [before[0].id, "Review", "{}"]), /permission denied/);
    await db.exec("reset role");
  }
  assert.ok(readFileSync("supabase-schema.sql", "utf8").includes(migration));
});
test("cron authenticates, reports failures as 503, and preserves independent website sync", async () => {
  let runs = 0; const alerts: string[] = [];
  const run = async () => { runs++; return reconcileBandcampOrders(true, deps()); };
  const alert = async (_: string, message: string) => { alerts.push(message); };
  const request = (secret: string) => new Request("https://fixture.invalid/api/cron/bandcamp-orders", { headers: { Authorization: `Bearer ${secret}` } });
  assert.equal((await runBandcampCron(request("bad"), "good", run, alert)).status, 401); assert.equal(runs, 0);
  assert.equal((await runBandcampCron(request("good"), "good", run, alert)).status, 200);
  const fail = async () => { throw new Error("Feed unavailable"); };
  assert.equal((await runBandcampCron(request("good"), "good", fail, alert)).status, 503); assert.equal(alerts.length, 1);
});
test("physical feed fetch never calls the digital sales API and rejects provider errors", async () => {
  const saved = process.env.DC_EMAIL_API_INTERNAL_SECRET; process.env.DC_EMAIL_API_INTERNAL_SECRET = "fixture-secret";
  try {
    const fake = (async (url: string | URL | Request, init?: RequestInit) => {
      assert.match(String(url), /\/api\/internal\/bandcamp-merch$/);
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fixture-secret");
      return Response.json(feed());
    }) as typeof fetch;
    assert.deepEqual(await fetchBandcampOrders(fake), feed());
    await assert.rejects(fetchBandcampOrders(async () => new Response("no", { status: 503 })), /HTTP 503/);
  } finally { if (saved === undefined) delete process.env.DC_EMAIL_API_INTERNAL_SECRET; else process.env.DC_EMAIL_API_INTERNAL_SECRET = saved; }
});
