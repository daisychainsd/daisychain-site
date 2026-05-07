"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./CartProvider";

export default function CartDrawer() {
  const { items, itemCount, subtotal, isOpen, setIsOpen, removeItem, updateQuantity } =
    useCart();
  const router = useRouter();
  const [checkingOut, setCheckingOut] = useState(false);

  const physicalItems = items.filter((i) => i.type !== "digital");
  const digitalItems = items.filter((i) => i.type === "digital");

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, setIsOpen]);

  function handlePhysicalCheckout() {
    setIsOpen(false);
    router.push("/shop/checkout");
  }

  async function handleDigitalCheckout() {
    setCheckingOut(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartItems: digitalItems.map((item) => ({
            slug: item.slug,
            trackKey: item.trackKey,
            trackTitle: item.title,
            releaseTitle: item.releaseTitle,
          })),
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        // Not logged in — bounce to login with redirect back
        setIsOpen(false);
        router.push("/login?redirect=" + encodeURIComponent(window.location.pathname));
        return;
      }
      if (data.url) {
        // Clear digital items from cart before redirecting to Stripe
        for (const item of digitalItems) {
          removeItem(item.variantId);
        }
        window.location.href = data.url;
        return;
      }
      if (data.guestRequired) {
        setIsOpen(false);
        router.push("/login?redirect=" + encodeURIComponent(window.location.pathname));
        return;
      }
    } catch {
      // silently fail
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity ease-in-out ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-[70] h-full w-full max-w-md bg-bg-surface border-l border-blue-300/10 shadow-2xl transition-transform ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-blue-300/10">
            <h2 className="text-title text-text-primary">Cart</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-raised transition-colors"
              aria-label="Close cart"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M12 4L4 12M4 4l8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mb-3 opacity-40">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6zM3 6h18M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-sm">Your cart is empty</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Digital items */}
                {digitalItems.length > 0 && (
                  <>
                    <p className="text-label text-xs uppercase tracking-wider text-text-muted" data-label>
                      Digital Tracks
                    </p>
                    {digitalItems.map((item) => (
                      <div
                        key={item.variantId}
                        className="flex gap-4 p-3 rounded-lg bg-bg-raised/50"
                      >
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.releaseTitle || item.title}
                            className="w-12 h-12 object-cover rounded-md shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {item.title}
                          </p>
                          <p className="text-xs text-text-muted mt-0.5 truncate">
                            {item.variantTitle}
                            {item.releaseTitle ? ` — ${item.releaseTitle}` : ""}
                          </p>
                          <p className="text-sm text-blue-300 mt-1">
                            ${item.price.toFixed(2)}
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(item.variantId)}
                          className="self-center text-text-muted hover:text-red-400 text-xs transition-colors shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </>
                )}

                {/* Physical items */}
                {physicalItems.length > 0 && (
                  <>
                    {digitalItems.length > 0 && (
                      <p className="text-label text-xs uppercase tracking-wider text-text-muted pt-2" data-label>
                        Physical
                      </p>
                    )}
                    {physicalItems.map((item) => (
                      <div
                        key={item.variantId}
                        className="flex gap-4 p-3 rounded-lg bg-bg-raised/50"
                      >
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-16 h-16 object-cover rounded-md shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {item.title}
                          </p>
                          {item.variantTitle !== "Default Title" && (
                            <p className="text-xs text-text-muted mt-0.5">
                              {item.variantTitle}
                            </p>
                          )}
                          <p className="text-sm text-blue-300 mt-1">
                            ${item.price.toFixed(2)}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() =>
                                updateQuantity(item.variantId, item.quantity - 1)
                              }
                              className="w-6 h-6 flex items-center justify-center rounded bg-bg-shelf text-text-secondary hover:text-text-primary text-xs transition-colors"
                            >
                              −
                            </button>
                            <span className="text-sm text-text-primary w-6 text-center" data-label>
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(item.variantId, item.quantity + 1)
                              }
                              className="w-6 h-6 flex items-center justify-center rounded bg-bg-shelf text-text-secondary hover:text-text-primary text-xs transition-colors"
                            >
                              +
                            </button>
                            <button
                              onClick={() => removeItem(item.variantId)}
                              className="ml-auto text-text-muted hover:text-red-400 text-xs transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="px-6 py-5 border-t border-blue-300/10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-text-secondary text-sm">
                  Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
                </span>
                <span className="text-text-primary font-semibold">
                  ${subtotal.toFixed(2)}
                </span>
              </div>

              {physicalItems.length > 0 && digitalItems.length > 0 ? (
                <div className="space-y-3">
                  <button
                    onClick={handleDigitalCheckout}
                    disabled={checkingOut}
                    className="w-full py-3 rounded-full bg-blue-300 text-bg-deep font-semibold text-sm hover:bg-blue-200 hover:shadow-[0_0_20px_rgba(124,185,232,0.15)] transition-colors disabled:opacity-50"
                  >
                    {checkingOut ? "Redirecting..." : `Checkout Digital (${digitalItems.length} ${digitalItems.length === 1 ? "track" : "tracks"})`}
                  </button>
                  <button
                    onClick={handlePhysicalCheckout}
                    className="w-full py-3 rounded-full border border-blue-300/30 text-blue-300 font-semibold text-sm hover:bg-blue-300/10 transition-colors"
                  >
                    Checkout Physical ({physicalItems.length} {physicalItems.length === 1 ? "item" : "items"})
                  </button>
                </div>
              ) : digitalItems.length > 0 ? (
                <>
                  <button
                    onClick={handleDigitalCheckout}
                    disabled={checkingOut}
                    className="w-full py-3 rounded-full bg-blue-300 text-bg-deep font-semibold text-sm hover:bg-blue-200 hover:shadow-[0_0_20px_rgba(124,185,232,0.15)] transition-colors disabled:opacity-50"
                  >
                    {checkingOut ? "Redirecting..." : "Checkout"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-text-muted text-xs mb-4">
                    Shipping calculated at checkout
                  </p>
                  <button
                    onClick={handlePhysicalCheckout}
                    className="w-full py-3 rounded-full bg-blue-300 text-bg-deep font-semibold text-sm hover:bg-blue-200 hover:shadow-[0_0_20px_rgba(124,185,232,0.15)] transition-colors"
                  >
                    Checkout
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
