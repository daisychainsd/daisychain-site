import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;

    if (!userId) {
      console.error("No userId in session metadata");
      return NextResponse.json({ received: true });
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
        return NextResponse.json({ received: true });
      }

      const { error } = await supabase.from("purchases").upsert(
        {
          user_id: userId,
          release_slug: slug,
          stripe_session_id: session.id,
        },
        { onConflict: "user_id,release_slug" }
      );

      if (error) {
        console.error("Failed to record purchase:", error);
      }
    }
  }

  return NextResponse.json({ received: true });
}
