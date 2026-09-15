import type Stripe from "stripe";
import { usesMerchBackend } from "./config";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderPayload, paidPhysicalSession } from "./orders";
import type { OrderItem } from "./types";
import { reconcileLegacyItems } from "./legacy";

export interface MerchWebhookDependencies {
  snapshot(id: string, livemode: boolean): Promise<OrderItem[]>;
  legacyItems(session: Stripe.Checkout.Session): Promise<OrderItem[]>;
  record(payload: ReturnType<typeof orderPayload>): Promise<void>;
  block(intent: string, status: "partially_refunded" | "refunded" | "disputed"): Promise<void>;
  physicalIntent(intent: string): Promise<boolean>;
}

export const merchWebhookDependencies: MerchWebhookDependencies = {
  async snapshot(id, livemode) {
    const { data, error } = await createAdminClient().from("merch_checkouts").select("items, livemode").eq("id", id).single();
    if (error || !data || data.livemode !== livemode) throw new Error("Checkout snapshot unavailable");
    return data.items as OrderItem[];
  },
  async legacyItems(session) {
    // In-flight sessions from before cutover still have the old variant metadata.
    const variants: { vid: string; qty: number }[] = JSON.parse(session.metadata?.variants ?? "[]");
    const lines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100, expand: ["data.price.product"] });
    if (lines.has_more || variants.length !== lines.data.length) throw new Error("Legacy order needs reconciliation");
    const { data, error } = await createAdminClient().from("merch_variants")
      .select("id, title, sku, merch_products!inner(title)").in("id", variants.map((v) => v.vid));
    if (error) throw new Error(error.message);
    return reconcileLegacyItems(variants, lines.data, data as unknown as Parameters<typeof reconcileLegacyItems>[2]);
  },
  async record(payload) {
    const { error } = await createAdminClient().rpc("record_merch_order", { payload });
    if (error) throw new Error(error.message);
  },
  async block(intent, status) {
    const { error } = await createAdminClient().rpc("block_merch_payment", { intent, new_status: status });
    if (error) throw new Error(error.message);
  },
  async physicalIntent(intent) {
    const sessions = await stripe.checkout.sessions.list({ payment_intent: intent, limit: 10 });
    return sessions.data.some((s) => s.metadata?.type === "physical" && (usesMerchBackend() || s.metadata.fulfillment_backend === "supabase"));
  },
};

/** Returns true when handled. Failures deliberately propagate to a retryable 503. */
export async function processMerchEvent(event: Stripe.Event, deps = merchWebhookDependencies): Promise<boolean> {
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.type !== "physical") return false;
    if (!paidPhysicalSession(session)) return true;
    const items = session.metadata?.merch_checkout_id
      ? await deps.snapshot(session.metadata.merch_checkout_id, session.livemode)
      : await deps.legacyItems(session);
    await deps.record(orderPayload(session, items));
    return true;
  }
  if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
    const object = event.data.object as Stripe.Charge | Stripe.Dispute;
    const intent = typeof object.payment_intent === "string" ? object.payment_intent : object.payment_intent?.id;
    if (!intent || !await deps.physicalIntent(intent)) return false;
    const status = event.type === "charge.dispute.created" ? "disputed"
      : (object as Stripe.Charge).refunded ? "refunded" : "partially_refunded";
    await deps.block(intent, status);
    return true;
  }
  return false;
}
