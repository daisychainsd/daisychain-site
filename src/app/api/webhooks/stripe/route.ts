import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDraftOrder } from "@/lib/shopify-admin";
import { sendDownloadEmail, sendPurchaseFailureAlert } from "@/lib/email";
import { generateDownloadToken } from "@/lib/download-tokens";
import { client } from "@/sanity/client";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      webhookSecret,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const purchaseType = session.metadata?.type;

    if (purchaseType === "physical") {
      await handlePhysicalOrder(session);
    } else if (purchaseType === "cart") {
      await handleCartPurchase(session);
    } else {
      await handleDigitalPurchase(session);
    }
  }

  return NextResponse.json({ received: true });
}

async function handlePhysicalOrder(session: Stripe.Checkout.Session) {
  const variantsRaw = session.metadata?.variants;
  if (!variantsRaw) {
    console.error("No variants in physical order metadata");
    return;
  }

  let variants: { vid: string; qty: number }[];
  try {
    variants = JSON.parse(variantsRaw);
  } catch {
    console.error("Failed to parse variants metadata:", variantsRaw);
    return;
  }

  const shippingInfo = session.collected_information?.shipping_details;
  const shipping = shippingInfo?.address;
  const name = shippingInfo?.name || session.customer_details?.name;

  try {
    const draftOrder = await createDraftOrder(
      {
        name: name || undefined,
        line1: shipping?.line1 || undefined,
        line2: shipping?.line2 || undefined,
        city: shipping?.city || undefined,
        state: shipping?.state || undefined,
        postal_code: shipping?.postal_code || undefined,
        country: shipping?.country || undefined,
      },
      variants.map((v) => ({ variantId: v.vid, quantity: v.qty })),
      session.customer_details?.email || undefined,
    );
    console.log("Created Shopify draft order:", draftOrder?.name);
  } catch (err) {
    console.error("Failed to create Shopify draft order:", err);
    await sendPurchaseFailureAlert({
      email: session.customer_details?.email || "unknown",
      slug: "physical-order",
      sessionId: session.id,
      error: `Shopify draft order failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

async function handleDigitalPurchase(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const isGuest = session.metadata?.isGuest === "true";

  if (isGuest) {
    const slug = session.metadata?.slug;
    const email = session.customer_details?.email || session.customer_email;
    if (slug && email) {
      // Save guest purchase to Supabase
      const trackKey = session.metadata?.trackKey || null;
      const supabase = createAdminClient();
      const { error: gpError } = await supabase
        .from("guest_purchases")
        .insert({
          email,
          release_slug: slug,
          stripe_session_id: session.id,
          ...(trackKey ? { track_key: trackKey } : {}),
        });
      if (gpError && gpError.code !== "23505") {
        console.error("Failed to record guest purchase:", gpError);
        await sendPurchaseFailureAlert({
          email,
          slug,
          sessionId: session.id,
          error: `guest: ${gpError.code}: ${gpError.message}`,
        });
      }

      // Generate a one-time download token for the email
      let token: string | undefined;
      try {
        token = await generateDownloadToken(slug, email);
      } catch (err) {
        console.error("Failed to generate download token:", err);
      }

      // Fetch cover art URL from Sanity
      let coverArtUrl: string | undefined;
      if (client) {
        try {
          const release = await client.fetch<{ coverArt?: string } | null>(
            `*[_type == "release" && slug.current == $slug][0]{ "coverArt": coverArt.asset->url }`,
            { slug },
          );
          coverArtUrl = release?.coverArt || undefined;
        } catch (err) {
          console.error("Failed to fetch cover art from Sanity:", err);
        }
      }

      const origin = "https://www.daisychainsd.com";
      const downloadUrl = token
        ? `${origin}/download/${slug}?token=${token}`
        : `${origin}/download/${slug}?session_id=${session.id}`;
      const title = session.metadata?.title || slug;
      const artist = session.metadata?.artist || "Daisy Chain";
      await sendDownloadEmail({
        to: email,
        releaseTitle: title,
        artistName: artist,
        downloadUrl,
        coverArtUrl,
      });
    }
    return;
  }

  if (!userId) {
    console.error("No userId in session metadata");
    return;
  }

  const supabase = createAdminClient();
  const purchaseType = session.metadata?.type;

  if (purchaseType === "unlimited_pass") {
    const { error } = await supabase
      .from("profiles")
      .update({
        has_unlimited_pass: true,
        unlimited_pass_purchased_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      console.error("Failed to activate unlimited pass:", error);
    }
  } else {
    const slug = session.metadata?.slug;
    if (!slug) {
      console.error("No slug in session metadata");
      return;
    }

    const trackKey = session.metadata?.trackKey || null;

    const row = {
      user_id: userId,
      release_slug: slug,
      stripe_session_id: session.id,
      ...(trackKey ? { track_key: trackKey } : {}),
    };
    const { error } = await supabase.from("purchases").insert(row);

    if (error) {
      // 23505 = duplicate key — purchase already recorded, safe to ignore
      if (error.code === "23505") {
        console.log("Purchase already recorded (duplicate):", slug);
      } else {
        console.error("Failed to record purchase:", error);
        await sendPurchaseFailureAlert({
          email: session.customer_details?.email || "unknown",
          slug,
          sessionId: session.id,
          error: `${error.code}: ${error.message}`,
        });
      }
    }
  }
}

async function handleCartPurchase(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("No userId in cart session metadata");
    return;
  }

  const cartTracksRaw = session.metadata?.cartTracks;
  if (!cartTracksRaw) {
    console.error("No cartTracks in cart session metadata");
    return;
  }

  let items: { slug: string; trackKey?: string; trackTitle?: string }[];
  try {
    items = JSON.parse(cartTracksRaw);
  } catch {
    console.error("Failed to parse cartTracks metadata:", cartTracksRaw);
    return;
  }

  const supabase = createAdminClient();

  const failures: string[] = [];
  for (const item of items) {
    const row = {
      user_id: userId,
      release_slug: item.slug,
      stripe_session_id: session.id,
      ...(item.trackKey ? { track_key: item.trackKey } : {}),
    };
    const { error } = await supabase.from("purchases").insert(row);
    if (error) {
      if (error.code === "23505") {
        console.log(`Cart item already recorded (duplicate): ${item.slug}`);
      } else {
        console.error(`Failed to record cart purchase (${item.slug}/${item.trackKey || "full"}):`, error);
        failures.push(`${item.slug}: ${error.code} ${error.message}`);
      }
    }
  }
  if (failures.length > 0) {
    await sendPurchaseFailureAlert({
      email: session.customer_details?.email || "unknown",
      slug: items.map((i) => i.slug).join(", "),
      sessionId: session.id,
      error: failures.join("; "),
    });
  }
}
