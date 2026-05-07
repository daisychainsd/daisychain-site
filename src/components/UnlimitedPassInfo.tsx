"use client";

import { useState, useRef, useEffect } from "react";

export default function UnlimitedPassInfo() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-5 h-5 flex items-center justify-center rounded-full border border-blue-300/30 text-blue-300/70 text-xs hover:bg-blue-300/10 transition-colors"
        aria-label="What is the Unlimited Music Pass?"
      >
        ?
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-4 rounded-lg bg-bg-surface border border-blue-300/15 shadow-xl z-50">
          <p className="text-text-primary text-sm font-semibold mb-2">
            Unlimited Music Pass
          </p>
          <ul className="text-text-secondary text-xs leading-relaxed space-y-1.5 list-none p-0 m-0">
            <li>Every release in our catalog, yours forever</li>
            <li>New drops delivered to your downloads a week early</li>
            <li>All future releases included — no extra cost</li>
            <li>Download in any format: WAV, FLAC, AIFF, MP3</li>
          </ul>
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-bg-surface border-r border-b border-blue-300/15"
          />
        </div>
      )}
    </div>
  );
}
