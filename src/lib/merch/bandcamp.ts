import { createAdminClient } from "@/lib/supabase/admin";
import type { MerchOrder, OrderItem } from "./types";

type Row = Record<string, unknown>;
export interface BandcampFeed { source: "bandcamp"; bandId: number; items: Row[] }
export interface BandcampOrderPayload {
  source_order_id: string;
  source_data: { payment_id: number; sale_item_ids: number[]; ship_dates: (string | null)[]; payment_states: string[] };
  email: string; customer_name: string; phone: string;
  shipping_address: MerchOrder["shipping_address"];
  items: OrderItem[];
  currency: string; subtotal_cents: number; shipping_cents: number; tax_cents: number; total_cents: number;
  payment_status: MerchOrder["payment_status"];
  fulfillment_status: "new" | "shipped" | "on_hold";
  shipped_at: string | null; notes: string; created_at: string;
}
const string = (v: unknown) => typeof v === "string" ? v.trim() : "";
function id(v: unknown): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v <= 0) throw new Error("Invalid Bandcamp ID or quantity");
  return v;
}
function cents(v: unknown, optional = false): number {
  if (v == null && optional) return 0;
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  const result = Math.round(n * 100);
  if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(result) || result > 2_147_483_647) throw new Error("Invalid Bandcamp amount");
  return result;
}
function date(v: unknown): string {
  const n = Date.parse(string(v));
  if (!Number.isFinite(n)) throw new Error("Invalid Bandcamp date");
  return new Date(n).toISOString();
}
function address(r: Row) {
  return { line1: string(r.ship_to_street), line2: string(r.ship_to_street_2), city: string(r.ship_to_city),
    state: string(r.ship_to_state), postal_code: string(r.ship_to_zip), country: string(r.ship_to_country_code).toUpperCase() };
}

// Input must come from get_orders v4, never the digital-inclusive sales report.
export function normalizeBandcampOrders(feed: BandcampFeed) {
  if (feed.source !== "bandcamp" || !Array.isArray(feed.items)) throw new Error("Expected Bandcamp physical merchandise feed");
  const bandId = id(feed.bandId);
  const groups = new Map<number, Row[]>();
  const seen = new Map<number, string>();
  for (const row of feed.items) {
    const saleId = id(row.sale_item_id), paymentId = id(row.payment_id);
    const previous = seen.get(saleId);
    if (previous) {
      if (previous !== JSON.stringify(row)) throw new Error(`Conflicting Bandcamp sale item ${saleId}`);
      continue;
    }
    seen.set(saleId, JSON.stringify(row));
    groups.set(paymentId, [...(groups.get(paymentId) ?? []), row]);
  }
  const orders: BandcampOrderPayload[] = [];
  const failures: { sourceOrderId: string; error: string }[] = [];
  for (const [paymentId, unordered] of groups) {
    const sourceOrderId = `${bandId}:${paymentId}`;
    try {
      const rows = [...unordered].sort((a, b) => id(a.sale_item_id) - id(b.sale_item_id));
      const first = rows[0], shippingAddress = address(first), currency = string(first.currency).toLowerCase();
      // These stores charge USD. Unsupported currencies must not silently get USD cent semantics.
      if (currency !== "usd") throw new Error(`Unsupported Bandcamp currency: ${currency}`);
      const recipient = string(first.ship_to_name) || string(first.buyer_name);
      if (rows.some(r => string(r.currency).toLowerCase() !== currency || JSON.stringify(address(r)) !== JSON.stringify(shippingAddress) ||
        (string(r.ship_to_name) || string(r.buyer_name)) !== recipient)) throw new Error("Bandcamp payment has different shipping destinations/currencies; split manually");
      const states = rows.map(r => string(r.payment_state));
      if (states.some(s => !["paid", "pending", "failed", "refunded"].includes(s))) throw new Error("Unknown Bandcamp payment state");
      const paymentStatus = states.includes("failed") ? "failed" : states.includes("pending") ? "pending" :
        states.every(s => s === "refunded") ? "refunded" : states.includes("refunded") ? "partially_refunded" : "paid";
      const shipDates = rows.map(r => r.ship_date ? date(r.ship_date) : null);
      const allShipped = shipDates.every(Boolean), someShipped = shipDates.some(Boolean);
      const sum = (key: string, optional = false) => rows.reduce((n, r) => n + cents(r[key], optional), 0);
      const subtotal = sum("sub_total"), shipping = sum("shipping", true), tax = sum("tax", true), total = sum("order_total");
      const items: OrderItem[] = rows.map(r => {
        const quantity = id(r.quantity), lineTotal = cents(r.sub_total), title = string(r.item_name);
        if (!title) throw new Error("Bandcamp merchandise title missing");
        return { variant_id: null, title, variant_title: string(r.option) || "Default Title", sku: string(r.sku),
          quantity, unit_price_cents: Math.round(lineTotal / quantity), line_total_cents: lineTotal };
      });
      const review: string[] = [];
      if (paymentStatus !== "paid") review.push(`Imported with ${paymentStatus.replaceAll("_", " ")} payment; confirm payment and review before shipping.`);
      if (someShipped && !allShipped) review.push("Partially shipped on Bandcamp: review each item before buying a label.");
      if (subtotal + shipping + tax !== total) review.push("Bandcamp totals need review before shipping.");
      if (!recipient || !shippingAddress.line1 || !shippingAddress.city || !shippingAddress.postal_code || !shippingAddress.country ||
        (shippingAddress.country === "US" && !shippingAddress.state)) review.push("Shipping address needs review.");
      const notes = [allShipped ? "Imported as shipped using Bandcamp's recorded ship dates." : "Imported from Bandcamp. Check Pirate Ship before shipping older orders.",
        ...review, ...rows.flatMap(r => [string(r.buyer_note), string(r.ship_notes)].filter(Boolean))].join("\n");
      orders.push({ source_order_id: sourceOrderId,
        source_data: { payment_id: paymentId, sale_item_ids: rows.map(r => id(r.sale_item_id)), ship_dates: shipDates, payment_states: states },
        email: string(first.buyer_email), customer_name: recipient, phone: string(first.ship_to_phone) || string(first.buyer_phone),
        shipping_address: shippingAddress, items, currency, subtotal_cents: subtotal, shipping_cents: shipping, tax_cents: tax, total_cents: total,
        payment_status: paymentStatus, fulfillment_status: allShipped ? "shipped" : paymentStatus !== "paid" || review.length ? "on_hold" : "new",
        shipped_at: allShipped ? [...shipDates].sort().at(-1)! : null, notes: notes.slice(0, 2000),
        created_at: rows.map(r => date(r.order_date)).sort()[0] });
    } catch (error) { failures.push({ sourceOrderId, error: error instanceof Error ? error.message : "Invalid Bandcamp order" }); }
  }
  return { orders, failures };
}

export async function fetchBandcampOrders(fetcher: typeof fetch = fetch): Promise<BandcampFeed> {
  const secret = process.env.DC_EMAIL_API_INTERNAL_SECRET;
  if (!secret) throw new Error("DC_EMAIL_API_INTERNAL_SECRET is not configured");
  const base = process.env.DC_EMAIL_API_URL ?? "https://dc-email-api.vercel.app";
  const response = await fetcher(`${base.replace(/\/$/, "")}/api/internal/bandcamp-merch`, {
    headers: { Authorization: `Bearer ${secret}` }, cache: "no-store", signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`Bandcamp physical order feed HTTP ${response.status}`);
  return response.json();
}

export interface BandcampDependencies {
  fetch: () => Promise<BandcampFeed>;
  existing: () => Promise<string[]>;
  record: (payload: BandcampOrderPayload) => Promise<{ created: boolean; review_needed?: boolean }>;
}
const dependencies: BandcampDependencies = {
  fetch: fetchBandcampOrders,
  existing: async () => {
    const ids: string[] = [];
    for (let page = 0; ; page++) {
      const { data, error } = await createAdminClient().from("merch_orders").select("source_order_id")
        .eq("source", "bandcamp").order("id").range(page * 1000, page * 1000 + 999);
      if (error) throw new Error("Bandcamp order storage unavailable; apply the Bandcamp migration");
      ids.push(...data.map(r => r.source_order_id));
      if (data.length < 1000) return ids;
    }
  },
  record: async payload => {
    const { data, error } = await createAdminClient().rpc("record_bandcamp_order", { payload });
    if (error) throw new Error(error.message);
    return data;
  },
};
export async function reconcileBandcampOrders(apply = false, deps: BandcampDependencies = dependencies) {
  const feed = await deps.fetch();
  const { orders, failures } = normalizeBandcampOrders(feed);
  const existing = new Set(await deps.existing());
  const report = { checkedItems: feed.items.length, physicalOrders: orders.length, missing: [] as string[], imported: 0, failures };
  for (const order of orders) {
    if (!existing.has(order.source_order_id)) report.missing.push(order.source_order_id);
    if (!apply) continue;
    try {
      const saved = await deps.record(order);
      if (saved.created) report.imported++;
      if (saved.review_needed) report.failures.push({ sourceOrderId: order.source_order_id, error: "Bandcamp items/address/amount changed; order held for review" });
    } catch (error) { report.failures.push({ sourceOrderId: order.source_order_id, error: error instanceof Error ? error.message : "Could not save Bandcamp order" }); }
  }
  return { report, orders };
}
