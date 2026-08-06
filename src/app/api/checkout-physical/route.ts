import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getVariantsByIds } from "@/lib/shopify";

/**
 * Only these two fields are trusted from the browser. Price, title and image
 * come from Shopify — the cart lives in localStorage, so anything else the
 * client sends is attacker-controlled (a forged price used to charge $0.01
 * for a real vinyl and still cut a full draft order).
 */
interface CartLineItem {
  variantId: string;
  quantity: number;
}

const MAX_LINES = 20;
const MAX_QTY_PER_LINE = 10;

export async function POST(req: NextRequest) {
  let items: CartLineItem[];
  try {
    const body = await req.json();
    items = body.items;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }
  if (items.length > MAX_LINES) {
    return NextResponse.json({ error: "Too many items in cart" }, { status: 400 });
  }

  // Normalize quantities before anything else touches them.
  const requested: { variantId: string; quantity: number }[] = [];
  for (const item of items) {
    const qty = Number(item?.quantity);
    if (
      typeof item?.variantId !== "string" ||
      !item.variantId.startsWith("gid://shopify/ProductVariant/") ||
      !Number.isInteger(qty) ||
      qty < 1 ||
      qty > MAX_QTY_PER_LINE
    ) {
      return NextResponse.json({ error: "Invalid cart item" }, { status: 400 });
    }
    requested.push({ variantId: item.variantId, quantity: qty });
  }

  try {
  const resolved = await getVariantsByIds(requested.map((i) => i.variantId));

  const lineItems = [];
  for (const item of requested) {
    const v = resolved.get(item.variantId);
    if (!v) {
      return NextResponse.json(
        { error: "One of these items is no longer available. Please refresh your cart." },
        { status: 409 },
      );
    }
    if (!v.availableForSale) {
      return NextResponse.json(
        { error: `${v.productTitle} just sold out.` },
        { status: 409 },
      );
    }
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: v.productTitle,
          description: v.title !== "Default Title" ? v.title : undefined,
          ...(v.imageUrl ? { images: [v.imageUrl] } : {}),
        },
        unit_amount: Math.round(v.amount * 100),
      },
      quantity: item.quantity,
    });
  }

  const variantMap = requested.map((i) => ({
    vid: i.variantId,
    qty: i.quantity,
  }));

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
    metadata: {
      type: "physical",
      variants: JSON.stringify(variantMap),
    },
    return_url: `${req.nextUrl.origin}/shop/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  });

  return NextResponse.json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error("Checkout physical error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
