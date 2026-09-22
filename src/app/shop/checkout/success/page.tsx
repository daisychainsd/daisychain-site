import { stripe } from "@/lib/stripe";
import { paidPhysicalSession, getOrderBySession } from "@/lib/merch/orders";
import SuccessClient from "./SuccessClient";

export const dynamic = "force-dynamic";
export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  let paid = false, saved = false;
  if (session_id?.startsWith("cs_") && session_id.length < 255) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      paid = paidPhysicalSession(session);
      if (paid) saved = !!await getOrderBySession(session.id);
    } catch { /* Show an unconfirmed state; never clear a cart without payment proof. */ }
  }
  return <SuccessClient paid={paid} saved={saved} />;
}
