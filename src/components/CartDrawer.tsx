"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./CartProvider";

export default function CartDrawer() {
  const { items, itemCount, subtotal, isOpen, setIsOpen, removeItem, updateQuantity } =
    useCart();
  const router = useRouter();

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

  function handleCheckout() {
    setIsOpen(false);
    router.push("/shop/checkout");
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
                {items.map((item) => (
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
              <p className="text-text-muted text-xs mb-4">
                Shipping calculated at checkout
              </p>
              <button
                onClick={handleCheckout}
                className="w-full py-3 rounded-full bg-blue-300 text-bg-deep font-semibold text-sm hover:bg-blue-200 hover:shadow-[0_0_20px_rgba(124,185,232,0.15)] transition-colors"
              >
                Checkout
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
