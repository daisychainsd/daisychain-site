import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

interface CartLineItem {
  variantId: string;
  title: string;
  variantTitle: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export async function POST(req: NextRequest) {
  let items: CartLineItem[];
  try {
    const body = await req.json();
    items = body.items;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  try {
  const lineItems = items.map((item) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: item.title,
        description:
          item.variantTitle !== "Default Title" ? item.variantTitle : undefined,
        ...(item.imageUrl ? { images: [item.imageUrl] } : {}),
      },
      unit_amount: Math.round(item.price * 100),
    },
    quantity: item.quantity,
  }));

  const variantMap = items.map((i) => ({
    vid: i.variantId,
    qty: i.quantity,
  }));

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded_page",
    mode: "payment",
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
