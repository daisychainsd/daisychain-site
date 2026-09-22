import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderPayload, paidPhysicalSession } from "./orders";
import type { OrderItem } from "./types";
import { capturedPhysicalItems } from "./legacy";

export interface MerchWebhookDependencies {
  snapshot(id: string, livemode: boolean): Promise<OrderItem[]>;
  legacyItems(session: Stripe.Checkout.Session): Promise<OrderItem[]>;
  record(payload: ReturnType<typeof orderPayload>, deductInventory: boolean): Promise<{ created: boolean }>;
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
    // Stripe's purchased snapshot must survive catalog renames/deletions.
    const lines: Stripe.LineItem[] = [];
    for await (const line of stripe.checkout.sessions.listLineItems(session.id, { limit: 100, expand: ["data.price.product"] })) lines.push(line);
    return capturedPhysicalItems(lines);
  },
  async record(payload, deductInventory) {
    const { data, error } = await createAdminClient().rpc("record_merch_order", { payload, deduct_inventory: deductInventory });
    if (error) throw new Error(error.message);
    if (typeof data?.created !== "boolean") throw new Error("Order persistence returned no result");
    return { created: data.created };
  },
  async block(intent, status) {
    const { error } = await createAdminClient().rpc("block_merch_payment", { intent, new_status: status });
    if (error) throw new Error(error.message);
  },
  async physicalIntent(intent) {
    const sessions = await stripe.checkout.sessions.list({ payment_intent: intent, limit: 10 });
    return sessions.data.some((s) => s.metadata?.type === "physical");
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
    await deps.record(orderPayload(session, items), !!session.metadata?.merch_checkout_id);
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
