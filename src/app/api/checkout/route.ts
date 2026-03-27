import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const { releaseId, title, artist, price, slug } = await req.json();

  if (!price || price <= 0) {
    return NextResponse.json({ error: "No price set" }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
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
    success_url: `${req.nextUrl.origin}/download/${slug}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${req.nextUrl.origin}/releases/${slug}`,
    metadata: {
      releaseId,
      slug,
    },
  });

  return NextResponse.json({ url: session.url });
}
