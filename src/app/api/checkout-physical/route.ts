import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getVariantsByIds } from "@/lib/shopify";
import { usesMerchBackend } from "@/lib/merch/config";
import { getCatalog } from "@/lib/merch/catalog";
import { normalizeCart, priceCart, MerchInputError } from "@/lib/merch/checkout";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Only these two fields are trusted from the browser. Price, title and image
 * come from the server catalog — the cart lives in localStorage, so anything else the
 * client sends is attacker-controlled (a forged price used to charge $0.01
 * for a real vinyl and still cut a full draft order).
 */
interface CartLineItem {
  variantId: string;
  quantity: number;
}

export async function POST(req: NextRequest) {
  let items: CartLineItem[];
  try {
    const body = await req.json();
    items = body.items;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
  const requested = normalizeCart(items);
  let checkoutId: string | undefined;
  let metadata: Record<string, string>;
  let lineItems;
  if (usesMerchBackend()) {
    const products = await getCatalog();
    const snapshot = priceCart(requested, products);
    const { data, error } = await createAdminClient().from("merch_checkouts").insert({
      items: snapshot,
      livemode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") || process.env.STRIPE_SECRET_KEY?.startsWith("rk_live_") || false,
    }).select("id").single();
    if (error || !data) throw new Error("Could not save checkout");
    checkoutId = data.id;
    metadata = { type: "physical", merch_checkout_id: data.id, fulfillment_backend: "supabase" };
    lineItems = snapshot.map((i) => ({
      price_data: { currency: "usd", unit_amount: i.unit_price_cents,
        product_data: { name: i.title, description: i.variant_title === "Default Title" ? undefined : i.variant_title } },
      quantity: i.quantity,
    }));
  } else {
    const resolved = await getVariantsByIds(requested.map((i) => i.variantId));
    lineItems = requested.map((item) => {
      const v = resolved.get(item.variantId);
      if (!v?.availableForSale) throw new MerchInputError("An item is unavailable. Please update your cart.");
      return { price_data: { currency: "usd", unit_amount: Math.round(v.amount * 100),
        product_data: { name: v.productTitle, description: v.title === "Default Title" ? undefined : v.title } }, quantity: item.quantity };
    });
    const variants = JSON.stringify(requested.map((i) => ({vid: i.variantId, qty: i.quantity})));
    if (variants.length > 500) throw new MerchInputError("Please split this purchase into smaller orders.");
    metadata = { type: "physical", variants };
  }

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded_page",
    mode: "payment",
    // Shows the "Add promotion code" field in checkout. The actual codes +
    // their discount/expiry are managed in the Stripe dashboard (Coupons →
    // Promotion codes), so we can run/end promos without a code change.
    allow_promotion_codes: true,
    line_items: lineItems,
    shipping_address_collection: {
      allowed_countries: [
        "US",
        "CA",
        "GB",
        "AU",
        "DE",
        "FR",
        "NL",
        "JP",
        "MX",
      ],
    },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: 599, currency: "usd" },
          display_name: "Standard Shipping",
          delivery_estimate: {
            minimum: { unit: "business_day", value: 5 },
            maximum: { unit: "business_day", value: 7 },
          },
        },
      },
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: 999, currency: "usd" },
          display_name: "Priority Shipping",
          delivery_estimate: {
            minimum: { unit: "business_day", value: 2 },
            maximum: { unit: "business_day", value: 3 },
          },
        },
      },
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: 1599, currency: "usd" },
          display_name: "International Shipping",
          delivery_estimate: {
            minimum: { unit: "business_day", value: 7 },
            maximum: { unit: "business_day", value: 14 },
          },
        },
      },
    ],
    metadata,
    return_url: `${req.nextUrl.origin}/shop/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  }, checkoutId ? { idempotencyKey: `merch-checkout-${checkoutId}` } : undefined);

  return NextResponse.json({ clientSecret: session.client_secret });
  } catch (err) {
    if (err instanceof MerchInputError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error("Checkout physical error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
