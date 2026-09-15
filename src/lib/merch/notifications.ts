import type Stripe from "stripe";
import { paidPhysicalSession } from "./orders";

interface Notifications {
  confirm(sessionId: string): Promise<void>;
  alert(key: string, message: string): Promise<void>;
}

/** Payment persistence has already succeeded. Notification failure must not undo it. */
export async function notifyMerchEvent(event: Stripe.Event, deps: Notifications) {
  try {
    if (event.type === "charge.dispute.created" && event.livemode) {
      await deps.alert(event.id, `A physical payment was disputed. Review ${event.data.object.id} in Stripe immediately, including any older Shopify order. Check its response deadline and fulfillment status.`);
    } else if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!paidPhysicalSession(session) || !session.livemode) return;
      try { await deps.confirm(session.id); }
      catch (error) {
        console.error("Merch confirmation failed after order was saved:", error);
        await deps.alert(`confirmation-${session.id}`, `Order ${session.id} was saved, but its confirmation email failed. Check Resend and the order in Merch Ops, then manually resend the Stripe event after fixing delivery.`);
      }
    }
  } catch (error) { console.error("Merch notification unavailable; order remains saved:", error); }
}
