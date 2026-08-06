"use client";

import { useCallback, useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
);

export default function CheckoutPage() {
  const { items, subtotal, itemCount } = useCart();
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/checkout-physical", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Only variant + quantity. The server prices from Shopify; sending a
        // price from here would be advisory at best and forgeable at worst.
        items: items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to create checkout session");
    }

    const data = await res.json();
    return data.clientSecret;
  }, [items]);

  // Note: CartProvider hydrates items from localStorage AFTER mount, so the
  // first run sees an empty cart. Clear the error once items appear instead of
  // dead-ending anyone who reloads or deep-links into checkout.
  useEffect(() => {
    if (items.length === 0) {
      setError("Your cart is empty. Add items before checking out.");
    } else {
      setError(null);
    }
  }, [items.length]);

  if (error || items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-text-muted text-lg mb-6">
          {error || "Your cart is empty"}
        </p>
        <Link
          href="/shop"
          className="inline-block px-6 py-2.5 rounded-full bg-blue-300 text-bg-deep font-semibold text-sm hover:bg-blue-200 transition-colors"
        >
          Back to Shop
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <Link
        href="/shop"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-blue-300 transition-colors mb-8"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M10 12L6 8l4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back to Shop
      </Link>

      <div className="mb-8">
        <p className="text-label mb-2">Checkout</p>
        <h1 className="text-headline">
          {itemCount} {itemCount === 1 ? "Item" : "Items"} — ${subtotal.toFixed(2)}
        </h1>
      </div>

      <div className="container-organic p-4 sm:p-6">
        <EmbeddedCheckoutProvider
          stripe={stripePromise}
          options={{ fetchClientSecret }}
        >
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </div>
  );
}
