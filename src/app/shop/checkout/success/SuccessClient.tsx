"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";

export default function SuccessClient({ paid, saved }: { paid: boolean; saved: boolean }) {
  const { clearPhysicalItems, hydrated } = useCart();
  useEffect(() => { if (paid && hydrated) clearPhysicalItems(); }, [paid, hydrated, clearPhysicalItems]);
  return <div className="max-w-2xl mx-auto px-6 py-20 text-center">
    <div className="container-organic p-10">
      <p className="text-label text-blue-300 mb-3">{paid ? "Payment received" : "Checkout"}</p>
      <h1 className="text-headline mb-5">{paid ? "Thank you" : "Payment pending"}</h1>
      <p className="text-text-secondary mb-8">{paid
        ? saved ? "Your order is saved. Keep your confirmation email for your records."
          : "Your payment was received. We’re finalizing your order. You do not need to pay again."
        : "We haven’t confirmed a completed payment for this checkout. If your payment is still processing, check back shortly."}</p>
      <Link href="/shop" className="btn-primary">Back to shop</Link>
    </div>
  </div>;
}
