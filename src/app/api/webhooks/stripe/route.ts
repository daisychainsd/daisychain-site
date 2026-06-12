import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDraftOrder } from "@/lib/shopify-admin";
import { sendDownloadEmail, sendOrderConfirmationEmail, sendPurchaseFailureAlert } from "@/lib/email";
import { generateDownloadToken } from "@/lib/download-tokens";
import { client } from "@/sanity/client";
import type Stripe from "stripe";

const BEEHIIV_PUB_ID = "pub_c63c3433-d698-4e9b-b9cc-de4a2af0b2ed";

async function subscribeToBeehiiv(email: string, campaign: string) {
  const apiKey = process.env.BEEHIIV_API_KEY;
  if (!apiKey || !email) return;
  try {
    await fetch(`https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        utm_source: "daisychainsd.com",
        utm_medium: "website",
        utm_campaign: campaign,
      }),
    });
  } catch (err) {
    console.error("Beehiiv subscribe failed:", err);
  }
}

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

  // Event-level idempotency. Stripe delivers at-least-once, so the same event
  // can arrive more than once (including after a transient 500 on our side).
  // We claim each event.id exactly once; a duplicate insert (23505) means we've
  // already processed it and can safely skip. Fails OPEN if the table is missing
  // so a not-yet-migrated deploy still processes purchases (just without dedup).
  try {
    const supabase = createAdminClient();
    const { error: claimErr } = await supabase
      .from("processed_stripe_events")
      .insert({ event_id: event.id });
    if (claimErr) {
      if (claimErr.code === "23505") {
        console.log("Duplicate Stripe event skipped:", event.id);
        return NextResponse.json({ received: true, duplicate: true });
      }
      // Table missing / other error → log and continue (fail open).
      console.error("Idempotency claim failed (continuing):", claimErr.code, claimErr.message);
    }
  } catch (err) {
    console.error("Idempotency claim threw (continuing):", err);
  }

  // Handlers are wrapped so a thrown side-effect error (e.g. Resend down) does
  // NOT 500 the webhook and trigger a Stripe retry that re-runs work that
  // already succeeded. Critical DB writes have their own failure alerts.
  try {
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
    } else if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
      await handleRefundOrDispute(event);
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err);
    await sendPurchaseFailureAlert({
      email: "unknown",
      slug: event.type,
      sessionId: event.id,
      error: `Handler threw: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return NextResponse.json({ received: true });
}

/**
 * Revoke access when a charge is refunded or disputed. Maps the charge back to
 * its Checkout Session (via payment_intent), then removes the matching purchase
 * rows / deactivates an unlimited pass, and alerts the owner.
 *
 * NOTE: requires the Stripe webhook endpoint to be subscribed to
 * `charge.refunded` and `charge.dispute.created` in the Stripe dashboard —
 * otherwise these events are never delivered and this code stays dormant.
 */
async function handleRefundOrDispute(event: Stripe.Event) {
  const charge =
    event.type === "charge.refunded"
      ? (event.data.object as Stripe.Charge)
      : null;
  const dispute =
    event.type === "charge.dispute.created"
      ? (event.data.object as Stripe.Dispute)
      : null;

  const paymentIntent = (charge?.payment_intent || dispute?.payment_intent) as
    | string
    | null
    | undefined;
  if (!paymentIntent) {
    console.error("Refund/dispute with no payment_intent:", event.id);
    return;
  }

  // Find the Checkout Session(s) for this payment intent.
  let sessions: Stripe.Checkout.Session[] = [];
  try {
    const list = await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 5 });
    sessions = list.data;
  } catch (err) {
    console.error("Failed to list sessions for refund/dispute:", err);
    return;
  }

  const supabase = createAdminClient();
  const revoked: string[] = [];

  for (const session of sessions) {
    const sid = session.id;
    // Remove logged-in + guest purchase rows tied to this session.
    const { error: pErr } = await supabase.from("purchases").delete().eq("stripe_session_id", sid);
    if (pErr) console.error("Failed to delete purchases on refund:", pErr);
    const { error: gErr } = await supabase
      .from("guest_purchases")
      .delete()
      .eq("stripe_session_id", sid);
    if (gErr) console.error("Failed to delete guest_purchases on refund:", gErr);

    // Deactivate an unlimited pass if this session bought one.
    if (session.metadata?.type === "unlimited_pass" && session.metadata?.userId) {
      const { error: passErr } = await supabase
        .from("profiles")
        .update({ has_unlimited_pass: false })
        .eq("id", session.metadata.userId);
      if (passErr) console.error("Failed to revoke unlimited pass on refund:", passErr);
    }
    revoked.push(sid);
  }

  const reason = event.type === "charge.refunded" ? "refunded" : "disputed (chargeback)";
  await sendPurchaseFailureAlert({
    email: charge?.billing_details?.email || "unknown",
    slug: `ACCESS REVOKED (${reason})`,
    sessionId: revoked.join(", ") || paymentIntent,
    error: `Charge ${reason}. Access removed for ${revoked.length} session(s). Verify in Stripe + Supabase.`,
  });
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
    if (session.customer_details?.email) {
      await subscribeToBeehiiv(session.customer_details.email, "physical_purchase");
    }
  } catch (err) {
    // Draft order failed but we still send confirmation below
    console.error("Failed to create Shopify draft order:", err);
    await sendPurchaseFailureAlert({
      email: session.customer_details?.email || "unknown",
      slug: "physical-order",
      sessionId: session.id,
      error: `Shopify draft order failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // Send confirmation email for physical orders
  const email = session.customer_details?.email;
  if (email) {
    // Retrieve line items from Stripe for item names
    let itemNames: { title: string }[] = [];
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      itemNames = lineItems.data.map((li) => ({ title: li.description || "Item" }));
    } catch {
      itemNames = [{ title: "Your order" }];
    }
    await sendOrderConfirmationEmail({
      to: email,
      customerName: session.customer_details?.name || undefined,
      type: "physical",
      items: itemNames,
      totalCents: session.amount_total || 0,
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
      // For single-track purchases the session link carries the trackKey (so the
      // download page can restrict to the purchased track). The release-scoped
      // token would grant the whole release, so only use it for full releases.
      const downloadUrl =
        token && !trackKey
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
      await subscribeToBeehiiv(email, "guest_purchase");
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
    // Send confirmation email for unlimited pass
    const passEmail = session.customer_details?.email;
    if (passEmail) {
      await sendOrderConfirmationEmail({
        to: passEmail,
        customerName: session.customer_details?.name || undefined,
        type: "unlimited_pass",
        items: [{ title: "Unlimited Pass" }],
        totalCents: session.amount_total || 0,
      });
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

    if (!error && session.customer_details?.email) {
      await subscribeToBeehiiv(session.customer_details.email, "digital_purchase");
    }

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

    // Send confirmation email for logged-in digital purchases
    const email = session.customer_details?.email;
    if (email) {
      const title = session.metadata?.title || slug;
      const artist = session.metadata?.artist || "Daisy Chain";
      let coverArtUrl: string | undefined;
      if (client) {
        try {
          const release = await client.fetch<{ coverArt?: string } | null>(
            `*[_type == "release" && slug.current == $slug][0]{ "coverArt": coverArt.asset->url }`,
            { slug },
          );
          coverArtUrl = release?.coverArt || undefined;
        } catch {
          // non-critical
        }
      }
      await sendOrderConfirmationEmail({
        to: email,
        customerName: session.customer_details?.name || undefined,
        type: "digital",
        items: [{ title, artist }],
        totalCents: session.amount_total || 0,
        coverArtUrl,
      });
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
  if (session.customer_details?.email) {
    await subscribeToBeehiiv(session.customer_details.email, "cart_purchase");
  }

  if (failures.length > 0) {
    await sendPurchaseFailureAlert({
      email: session.customer_details?.email || "unknown",
      slug: items.map((i) => i.slug).join(", "),
      sessionId: session.id,
      error: failures.join("; "),
    });
  }

  // Send confirmation email for cart purchases
  const email = session.customer_details?.email;
  if (email) {
    const cartItems = items.map((item) => ({
      title: item.trackTitle || item.slug,
    }));
    await sendOrderConfirmationEmail({
      to: email,
      customerName: session.customer_details?.name || undefined,
      type: "cart",
      items: cartItems,
      totalCents: session.amount_total || 0,
    });
  }
}
