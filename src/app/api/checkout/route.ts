import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

/**
 * Create a Stripe Checkout session for a digital release purchase.
 *
 * Two paths:
 *   - Authenticated: existing flow. Uses Supabase user.email + userId metadata.
 *     Success URL drops back into /account?purchased=<slug> so downloads
 *     appear in the user's dashboard.
 *   - Guest: caller provides `guestEmail` in the body. No userId metadata,
 *     `isGuest: "true"` flag instead. Success URL goes to
 *     /download/<slug>?session_id={CHECKOUT_SESSION_ID} which uses
 *     /api/verify-purchase to validate the session before serving downloads.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = await req.json();
  const { releaseId, title, artist, price, slug } = body;
  const guestEmail =
    typeof body.guestEmail === "string" ? body.guestEmail.trim().toLowerCase() : undefined;

  // Either an authenticated user OR a valid guest email must be present.
  if (!user && !guestEmail) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!price || price <= 0) {
    return NextResponse.json({ error: "No price set" }, { status: 400 });
  }

  const isGuest = !user;
  const customerEmail = user?.email ?? guestEmail;
  const origin = req.nextUrl.origin;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    customer_email: customerEmail,
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
    // Logged-in users go to their dashboard; guests get the legacy single-release
    // download page which validates the Stripe session against the slug.
    success_url: isGuest
      ? `${origin}/download/${slug}?session_id={CHECKOUT_SESSION_ID}`
      : `${origin}/account?purchased=${slug}`,
    cancel_url: `${origin}/releases/${slug}`,
    metadata: {
      releaseId,
      slug,
      ...(user ? { userId: user.id } : { isGuest: "true" }),
    },
  });

  return NextResponse.json({ url: session.url });
}
