import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MerchOrder, OrderItem } from "./types";

export function paidPhysicalSession(session: Stripe.Checkout.Session) {
  return session.metadata?.type === "physical" && session.status === "complete" &&
    (session.payment_status === "paid" || (session.payment_status === "no_payment_required" && session.amount_total === 0));
}

export function orderPayload(session: Stripe.Checkout.Session, items: OrderItem[]) {
  if (!paidPhysicalSession(session)) throw new Error("Physical order is not paid");
  if (!items.length || items.some((i) => !Number.isSafeInteger(i.quantity) || i.quantity < 1 ||
    !Number.isSafeInteger(i.unit_price_cents) || i.unit_price_cents < 0 || !i.title)) throw new Error("Invalid order snapshot");
  if (session.currency !== "usd" || items.reduce((sum, i) => sum + i.quantity * i.unit_price_cents, 0) !== session.amount_subtotal) throw new Error("Paid checkout does not match its order snapshot");
  // Older Stripe sessions used the top-level shipping_details field.
  const shipping = session.collected_information?.shipping_details ??
    (session as Stripe.Checkout.Session & { shipping_details?: Stripe.Checkout.Session.CollectedInformation.ShippingDetails }).shipping_details;
  return {
    stripe_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
    livemode: session.livemode,
    email: session.customer_details?.email ?? session.customer_email ?? "",
    customer_name: shipping?.name ?? session.customer_details?.name ?? "",
    phone: session.customer_details?.phone ?? "",
    shipping_address: shipping?.address ?? {}, items,
    currency: session.currency ?? "usd",
    subtotal_cents: session.amount_subtotal ?? 0,
    shipping_cents: session.total_details?.amount_shipping ?? 0,
    discount_cents: session.total_details?.amount_discount ?? 0,
    tax_cents: session.total_details?.amount_tax ?? 0,
    total_cents: session.amount_total ?? 0,
    created_at: new Date(session.created * 1000).toISOString(),
  };
}

export async function getOrderBySession(sessionId: string): Promise<MerchOrder | null> {
  const { data, error } = await createAdminClient().from("merch_orders").select("*")
    .eq("stripe_session_id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as MerchOrder | null;
}

export async function listOrders(status = "new", test = false, page = 0): Promise<MerchOrder[]> {
  let query = createAdminClient().from("merch_orders").select("*").eq("livemode", !test)
    .order("created_at", { ascending: false }).range(page * 50, page * 50 + 49);
  if (status === "unshipped") query = query.neq("fulfillment_status", "shipped");
  else if (status !== "all") query = query.eq("fulfillment_status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as MerchOrder[];
}
