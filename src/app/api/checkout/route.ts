import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { client as sanityClient } from "@/sanity/client";

const PER_TRACK_PRICE = 2;

/**
 * Create a Stripe Checkout session for a digital release or single-track purchase.
 *
 * Two purchase types:
 *   - Full release: sends `slug` (no `trackKey`). Price from Sanity.
 *   - Single track: sends `slug` + `trackKey` + `trackTitle`. Fixed $2.
 *
 * Two auth paths:
 *   - Authenticated: uses Supabase user.email + userId metadata.
 *   - Guest: caller provides `guestEmail` + `guestCheckout: true`.
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
  const { releaseId, slug, trackKey, trackTitle } = body;
  const guestEmail =
    typeof body.guestEmail === "string" ? body.guestEmail.trim().toLowerCase() : undefined;

  const forceGuestCheckout =
    body.guestCheckout === true || body.guestCheckout === "true";

  const isGuestCheckout = Boolean(
    guestEmail && (!user || forceGuestCheckout),
  );

  if (!isGuestCheckout && !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const slugStr = typeof slug === "string" ? slug.trim() : "";
  if (!slugStr) {
    return NextResponse.json({ error: "Missing release" }, { status: 400 });
  }

  const isTrackPurchase = typeof trackKey === "string" && trackKey.length > 0;

  // Server-side price lookup — never trust client-supplied price.
  const release = sanityClient
    ? await sanityClient.fetch<{ title: string; artist: string; price: number | null } | null>(
        `*[_type == "release" && slug.current == $slug][0] {
          title,
          "artist": coalesce(artists[0]->name, displayArtist, artist->name),
          price
        }`,
        { slug: slugStr },
      )
    : null;

  if (!release) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }

  const unitPrice = isTrackPurchase ? PER_TRACK_PRICE : release.price;
  if (!unitPrice || unitPrice <= 0) {
    return NextResponse.json({ error: "No price set for this release" }, { status: 400 });
  }

  const productName = isTrackPurchase
    ? (trackTitle || "Track")
    : release.title;
  const productDesc = isTrackPurchase
    ? `${release.artist} — ${release.title} — Single Track (WAV)`
    : `${release.artist} — Digital Download (WAV)`;

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
              name: productName,
              description: productDesc,
            },
            unit_amount: Math.round(unitPrice * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: isGuestCheckout
        ? `${origin}/download/${slugStr}?session_id={CHECKOUT_SESSION_ID}`
        : `${origin}/account?purchased=${slugStr}`,
      cancel_url: `${origin}/releases/${slugStr}`,
      metadata: {
        releaseId,
        slug: slugStr,
        title: release.title,
        artist: release.artist,
        ...(isTrackPurchase ? { trackKey, trackTitle: trackTitle || "" } : {}),
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
