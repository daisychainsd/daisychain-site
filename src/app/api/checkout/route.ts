import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { client as sanityClient } from "@/sanity/client";

const PER_TRACK_PRICE = 2;

/**
 * Create a Stripe Checkout session for digital purchases.
 *
 * Accepts three shapes:
 *   1. Single full release: `{ slug }` — price from Sanity.
 *   2. Single track: `{ slug, trackKey, trackTitle }` — fixed $2.
 *   3. Cart batch: `{ cartItems: [{ slug, trackKey, trackTitle }] }` — $2 each.
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
  const { cartItems } = body;

  // Cart batch mode — multiple tracks at $2 each
  if (Array.isArray(cartItems) && cartItems.length > 0) {
    return handleCartCheckout(req, user, cartItems);
  }

  // Single item mode (existing flow)
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

/**
 * Handle cart-based checkout for multiple digital tracks.
 * Creates a single Stripe session with one line item per track at $2 each.
 * Stores track details as JSON in session metadata for the webhook to process.
 */
async function handleCartCheckout(
  req: NextRequest,
  user: { id: string; email?: string } | null,
  cartItems: { slug: string; trackKey: string; trackTitle?: string; releaseTitle?: string }[],
) {
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Dedupe and validate
  const seen = new Set<string>();
  const validItems: typeof cartItems = [];
  for (const item of cartItems) {
    if (!item.slug || !item.trackKey) continue;
    const key = `${item.slug}-${item.trackKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    validItems.push(item);
  }

  if (validItems.length === 0) {
    return NextResponse.json({ error: "No valid items" }, { status: 400 });
  }

  // Look up release info for each unique slug
  const slugs = [...new Set(validItems.map((i) => i.slug))];
  const releases = sanityClient
    ? await sanityClient.fetch<{ slug: string; title: string; artist: string }[]>(
        `*[_type == "release" && slug.current in $slugs] {
          "slug": slug.current,
          title,
          "artist": coalesce(artists[0]->name, displayArtist, artist->name)
        }`,
        { slugs },
      )
    : [];

  const releaseMap = new Map(releases.map((r) => [r.slug, r]));

  const lineItems = validItems.map((item) => {
    const release = releaseMap.get(item.slug);
    const artist = release?.artist || "Daisy Chain";
    const relTitle = release?.title || item.releaseTitle || item.slug;
    return {
      price_data: {
        currency: "usd" as const,
        product_data: {
          name: item.trackTitle || "Track",
          description: `${artist} — ${relTitle} — Single Track (WAV)`,
        },
        unit_amount: PER_TRACK_PRICE * 100,
      },
      quantity: 1 as const,
    };
  });

  const origin = req.nextUrl.origin;

  // Store track list as JSON in metadata for the webhook
  const tracksMeta = JSON.stringify(
    validItems.map((item) => ({
      slug: item.slug,
      trackKey: item.trackKey,
      trackTitle: item.trackTitle || "",
    })),
  );

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: user.email!,
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/account?purchased=cart`,
      cancel_url: `${origin}/music`,
      metadata: {
        userId: user.id,
        type: "cart",
        cartTracks: tracksMeta,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    console.error("Stripe cart checkout.session.create:", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
