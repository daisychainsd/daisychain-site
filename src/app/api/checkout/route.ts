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
 *   - Guest: caller provides `guestEmail`, and should send `guestCheckout: true`
 *     from /login so the session stays guest even if a stale auth cookie exists.
 *     No userId metadata; `isGuest: "true"` instead. Success URL goes to
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
  const { releaseId, title, artist, slug } = body;
  const guestEmail =
    typeof body.guestEmail === "string" ? body.guestEmail.trim().toLowerCase() : undefined;

  const forceGuestCheckout =
    body.guestCheckout === true || body.guestCheckout === "true";

  // Guest checkout from /login must stay on the guest path even when a stale
  // Supabase session cookie exists; otherwise Stripe gets account success_url +
  // userId metadata and the buyer never lands on /download.
  const isGuestCheckout = Boolean(
    guestEmail && (!user || forceGuestCheckout),
  );

  // Either an authenticated user OR a valid guest email must be present.
  if (!isGuestCheckout && !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const priceUsd =
    typeof body.price === "number" ? body.price : Number(body.price);
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    return NextResponse.json({ error: "No price set" }, { status: 400 });
  }

  const slugStr = typeof slug === "string" ? slug.trim() : "";
  if (isGuestCheckout && !slugStr) {
    return NextResponse.json({ error: "Missing release" }, { status: 400 });
  }

  const customerEmail = isGuestCheckout ? guestEmail! : user!.email!;
  const origin = req.nextUrl.origin;

  let session;
  try {
    session = await stripe.checkout.sessions.create({
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
            unit_amount: Math.round(priceUsd * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      // Logged-in users go to their dashboard; guests get the single-release
      // download page which validates the Stripe session against the slug.
      success_url: isGuestCheckout
        ? `${origin}/download/${slugStr}?session_id={CHECKOUT_SESSION_ID}`
        : `${origin}/account?purchased=${slugStr}`,
      cancel_url: `${origin}/releases/${slugStr}`,
      metadata: {
        releaseId,
        slug: slugStr,
        title: title || "",
        artist: artist || "",
        ...(isGuestCheckout ? { isGuest: "true" } : { userId: user!.id }),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    console.error("Stripe checkout.session.create:", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
