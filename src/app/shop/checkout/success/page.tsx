"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";

export default function CheckoutSuccessPage() {
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <div className="container-organic p-10 sm:p-14">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 6L9 17l-5-5"
              stroke="#22c55e"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className="text-label mb-2">Order Confirmed</p>
        <h1 className="text-headline mb-4">Thank You!</h1>
        <p className="text-text-secondary mb-8 max-w-md mx-auto">
          Your order has been placed. You&apos;ll receive a confirmation email shortly
          with tracking details once your order ships.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/shop"
            className="px-6 py-2.5 rounded-full bg-blue-300 text-bg-deep font-semibold text-sm hover:bg-blue-200 transition-colors"
          >
            Continue Shopping
          </Link>
          <Link
            href="/"
            className="px-6 py-2.5 rounded-full border border-blue-300/20 text-text-secondary font-medium text-sm hover:text-blue-300 hover:border-blue-300/40 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
