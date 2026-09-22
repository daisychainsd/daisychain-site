import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrderBySession, orderPayload, paidPhysicalSession } from "./orders";
import { merchWebhookDependencies, type MerchWebhookDependencies } from "./webhook";
import type { MerchOrder, OrderItem } from "./types";

type PaymentBlock = "partially_refunded" | "refunded" | "disputed";
export interface ReconciliationDependencies {
  sessions(): AsyncIterable<Stripe.Checkout.Session>;
  items(session: Stripe.Checkout.Session): Promise<OrderItem[]>;
  find(sessionId: string): Promise<MerchOrder | null>;
  paymentBlock(intentId: string): Promise<PaymentBlock | null>;
  record: MerchWebhookDependencies["record"];
  block: MerchWebhookDependencies["block"];
  annotate(sessionId: string): Promise<void>;
}

export function currentPaymentBlock(charge: Pick<Stripe.Charge, "disputed" | "amount_refunded" | "refunded">, disputes: Pick<Stripe.Dispute, "status">[]): PaymentBlock | null {
  // Charge.disputed stays true after a win. Do not recreate a resolved hold.
  if (charge.disputed && (!disputes.length || disputes.some((d) => !["won", "warning_closed", "prevented"].includes(d.status)))) return "disputed";
  return charge.amount_refunded > 0 ? charge.refunded ? "refunded" : "partially_refunded" : null;
}

export const reconciliationDependencies: ReconciliationDependencies = {
  sessions: () => stripe.checkout.sessions.list({ status: "complete", limit: 100 }),
  items: (session) => session.metadata?.merch_checkout_id
    ? merchWebhookDependencies.snapshot(session.metadata.merch_checkout_id, session.livemode)
    : merchWebhookDependencies.legacyItems(session),
  find: getOrderBySession,
  async paymentBlock(intentId) {
    const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
    const charge = intent.latest_charge;
    if (!charge || typeof charge === "string") throw new Error("Payment charge unavailable for reconciliation");
    const disputes: Stripe.Dispute[] = [];
    if (charge.disputed) {
      for await (const dispute of stripe.disputes.list({ charge: charge.id, limit: 100 })) disputes.push(dispute);
    }
    return currentPaymentBlock(charge, disputes);
  },
  record: (...args) => merchWebhookDependencies.record(...args),
  block: (...args) => merchWebhookDependencies.block(...args),
  async annotate(sessionId) {
    const { error } = await createAdminClient().from("merch_orders")
      .update({ notes: "Recovered from Stripe. Shipping history unverified: check Pirate Ship before shipping." })
      .eq("stripe_session_id", sessionId).eq("notes", "").eq("fulfillment_status", "new");
    if (error) throw new Error(error.message);
  },
};

// Scan full paginated history: a date window would miss the backlog.
// Never send customer emails or Shopify drafts, or infer shipping state.
export async function reconcilePhysicalOrders(apply = false, deps = reconciliationDependencies) {
  const report = { checked: 0, physical: 0, missing: [] as string[], imported: 0, failures: [] as { session: string; error: string }[] };
  const recovered: ReturnType<typeof orderPayload>[] = [];
  for await (const session of deps.sessions()) {
    report.checked++;
    if (!paidPhysicalSession(session)) continue;
    report.physical++;
    try {
      const payload = orderPayload(session, await deps.items(session));
      recovered.push(payload);
      // Still produce a recovery file when the missing schema is the problem.
      const existing = await deps.find(session.id);
      if (!existing) report.missing.push(session.id);
      if (!apply) continue;
      if (payload.stripe_payment_intent_id) {
        const status = await deps.paymentBlock(payload.stripe_payment_intent_id);
        const severity = ["paid", "partially_refunded", "refunded", "disputed"];
        // Preserve a partial refund that staff already reviewed/released.
        if (status && (!existing || severity.indexOf(status) > severity.indexOf(existing.payment_status))) {
          await deps.block(payload.stripe_payment_intent_id, status);
        }
      }
      if (existing) continue;
      // The webhook can win after find(); only the transaction knows who inserted.
      const result = await deps.record(payload, !!session.metadata?.merch_checkout_id);
      if (!result.created) continue;
      report.imported++;
      await deps.annotate(session.id);
    } catch (error) {
      report.failures.push({ session: session.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { report, recovered };
}

export function reconciliationFailed(report: Awaited<ReturnType<typeof reconcilePhysicalOrders>>["report"], apply: boolean) {
  return report.failures.length > 0 || (!apply && report.missing.length > 0);
}
