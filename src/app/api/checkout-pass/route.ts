import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(_req: NextRequest) {
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

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Daisy Chain Unlimited Pass",
            description:
              "Lifetime access to download all current and future Daisy Chain releases in WAV format.",
          },
          unit_amount: 10000,
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

  return NextResponse.json({ url: session.url });
}
