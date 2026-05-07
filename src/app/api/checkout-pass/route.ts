import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

const PASS_PRICE = 99; // dollars

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Calculate credit from past purchases
  const { data: payments } = await supabase
    .from("purchases")
    .select("stripe_session_id")
    .eq("user_id", user.id);

  let creditCents = 0;
  if (payments && payments.length > 0) {
    // Get unique session IDs to look up actual payment amounts
    const sessionIds: string[] = [...new Set((payments as { stripe_session_id: string }[]).map((p) => p.stripe_session_id))];
    for (const sid of sessionIds) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sid);
        if (session.payment_status === "paid" && session.amount_total) {
          creditCents += session.amount_total;
        }
      } catch {
        // Session may not exist in test mode, skip
      }
    }
  }

  const fullPriceCents = PASS_PRICE * 100;
  // Minimum charge is $1 (Stripe minimum) — never go below 100 cents
  const chargeAmount = Math.max(fullPriceCents - creditCents, 100);
  const creditDollars = creditCents / 100;

  const description = creditCents > 0
    ? `Lifetime access to every Daisy Chain release — past, present, and future — plus early access a week before each drop. ($${creditDollars.toFixed(2)} credit applied from previous purchases.)`
    : "Lifetime access to every Daisy Chain release — past, present, and future — plus early access a week before each drop.";

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Daisy Chain Unlimited Music Pass",
              description,
            },
            unit_amount: chargeAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.nextUrl.origin}/account?pass=activated`,
      cancel_url: `${req.nextUrl.origin}/account`,
      metadata: {
        userId: user.id,
        type: "unlimited_pass",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    console.error("Stripe checkout-pass:", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ url: session.url, credit: creditDollars, chargeAmount: chargeAmount / 100 });
}
