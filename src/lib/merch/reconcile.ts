import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrderBySession, orderPayload, paidPhysicalSession } from "./orders";
import { merchWebhookDependencies } from "./webhook";

// The full paginated history is intentional: a date window would miss the backlog.
// Never sends customer emails, creates Shopify drafts, or overwrites shipping state.
export async function reconcilePhysicalOrders(apply = false) {
  const report = { checked: 0, physical: 0, missing: [] as string[], imported: 0, failures: [] as { session: string; error: string }[] };
  const recovered: ReturnType<typeof orderPayload>[] = [];
  for await (const session of stripe.checkout.sessions.list({ status: "complete", limit: 100 })) {
    report.checked++;
    if (!paidPhysicalSession(session)) continue;
    report.physical++;
    try {
      const items = session.metadata?.merch_checkout_id
        ? await merchWebhookDependencies.snapshot(session.metadata.merch_checkout_id, session.livemode)
        : await merchWebhookDependencies.legacyItems(session);
      const payload = orderPayload(session, items);
      recovered.push(payload);
      // Audit still produces recovery files when the missing schema is the problem.
      const existing = await getOrderBySession(session.id);
      if (!existing) report.missing.push(session.id);
      if (!apply) continue;
      // Record refunds/disputes first so refunded historical purchases cannot enter shipping.
      if (payload.stripe_payment_intent_id) {
        const intent = await stripe.paymentIntents.retrieve(payload.stripe_payment_intent_id, { expand: ["latest_charge"] });
        const charge = intent.latest_charge as Stripe.Charge | null;
        if (charge && (charge.disputed || charge.amount_refunded > 0)) {
          const status = charge.disputed ? "disputed" : charge.refunded ? "refunded" : "partially_refunded";
          // Do not re-hold a partial refund that staff already reviewed/released.
          const severity = ["paid", "partially_refunded", "refunded", "disputed"];
          if (!existing || severity.indexOf(status) > severity.indexOf(existing.payment_status)) {
            await merchWebhookDependencies.block(intent.id, status);
          }
        }
      }
      if (existing) continue;
      await merchWebhookDependencies.record(payload, !!session.metadata?.merch_checkout_id);
      // Historical shipping is unknown. Keep the conservative unshipped default
      // and surface the manual reconciliation task without altering existing records.
      const { error } = await createAdminClient().from("merch_orders")
        .update({ notes: "Recovered from Stripe. Shipping history unverified: check Pirate Ship before shipping." })
        .eq("stripe_session_id", session.id).eq("notes", "").eq("fulfillment_status", "new");
      if (error) throw new Error(error.message);
      report.imported++;
    } catch (error) {
      report.failures.push({ session: session.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { report, recovered };
}
