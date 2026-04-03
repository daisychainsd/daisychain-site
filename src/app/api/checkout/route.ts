import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

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

  const { releaseId, title, artist, price, slug } = await req.json();

  if (!price || price <= 0) {
    return NextResponse.json({ error: "No price set" }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: title,
            description: `${artist} — Digital Download (WAV)`,
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${req.nextUrl.origin}/account?purchased=${slug}`,
    cancel_url: `${req.nextUrl.origin}/releases/${slug}`,
    metadata: {
      userId: user.id,
      releaseId,
      slug,
    },
  });

  return NextResponse.json({ url: session.url });
}
