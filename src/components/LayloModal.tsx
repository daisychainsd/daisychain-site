"use client";

import { useState, useEffect } from "react";

// Drop ID for the Laylo "Upcoming Label Releases" campaign — fans who sign up
// here get auto-notified by Laylo when we ship new music. Read from a public
// env var so swapping drops doesn't require a code change. Fallback below is
// the original dropId from initial setup; replace via `NEXT_PUBLIC_LAYLO_DROP_ID`
// in Vercel + .env.local when the active drop changes.
const DROP_ID =
  process.env.NEXT_PUBLIC_LAYLO_DROP_ID || "feb0139b-a3c8-48cb-9aea-97055521f1b6";

export default function LayloModal() {
  const [open, setOpen] = useState(false);

  // Load the Laylo SDK script once. Some embed features (analytics, postMessage
  // resize hooks) come from this SDK; the iframe still renders without it.
  useEffect(() => {
    if (document.querySelector('script[src="https://embed.laylo.com/laylo-sdk.js"]')) return;
    const script = document.createElement("script");
    script.src = "https://embed.laylo.com/laylo-sdk.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-text-secondary hover:text-text-primary text-left transition-colors text-xs"
      >
        i hate presaving, just notify me when it&apos;s out →
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-bg-deep/80 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative z-10 w-full max-w-lg container-organic overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-bg-raised/80 text-text-muted hover:text-text-primary hover:bg-bg-elevated flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </button>

            <iframe
              id={`laylo-drop-${DROP_ID}`}
              title="Subscribe for Daisy Chain release notifications"
              frameBorder="0"
              scrolling="no"
              allow="web-share"
              allowTransparency
              style={{ width: "1px", minWidth: "100%", maxWidth: "1000px", height: "560px", display: "block" }}
              src={`https://embed.laylo.com?dropId=${DROP_ID}&color=C8D1DF&minimal=false&theme=dark`}
            />
          </div>
        </div>
      )}
    </>
  );
}
