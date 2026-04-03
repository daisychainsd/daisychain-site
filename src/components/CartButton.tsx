"use client";

import { useCart } from "./CartProvider";

export default function CartButton() {
  const { itemCount, setIsOpen } = useCart();

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="relative px-3 py-1.5 rounded-lg text-text-secondary hover:text-blue-300 hover:bg-blue-300/5 transition-colors"
      aria-label={`Cart (${itemCount} items)`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="inline-block">
        <path
          d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6zM3 6h18M16 10a4 4 0 01-8 0"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {itemCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-blue-300 text-bg-deep text-[10px] font-bold leading-none px-1">
          {itemCount}
        </span>
      )}
    </button>
  );
}
