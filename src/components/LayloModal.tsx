"use client";

import { useState, useEffect } from "react";
import { ArrowIcon } from "@/components/icons";

// Common country dial codes — same set as LeadGen.
const COUNTRY_CODES: { code: string; label: string }[] = [
  { code: "+1", label: "US" },
  { code: "+52", label: "MX" },
  { code: "+44", label: "UK" },
  { code: "+61", label: "AU" },
  { code: "+33", label: "FR" },
  { code: "+49", label: "DE" },
  { code: "+34", label: "ES" },
  { code: "+39", label: "IT" },
  { code: "+31", label: "NL" },
  { code: "+81", label: "JP" },
  { code: "+82", label: "KR" },
  { code: "+55", label: "BR" },
  { code: "+91", label: "IN" },
];

/**
 * Compact "drop your number, we'll text when it's out" modal. Hits our own
 * `/api/laylo-subscribe` endpoint which forwards to Laylo's `subscribeToUser`
 * GraphQL mutation. Subscribers land in the Daisy Chain Laylo audience and
 * get pinged automatically whenever a new drop is broadcast from the dashboard.
 *
 * Replaces the previous Laylo iframe embed (was rendering blank in production
 * due to SDK + iframe coordination issues across origins).
 */
export default function LayloModal() {
  const [open, setOpen] = useState(false);
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Reset form state when modal closes so a fresh open doesn't leak prior status.
  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setErrorMsg("");
      setPhone("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    const phoneDigits = phone.replace(/\D/g, "");
    try {
      const res = await fetch("/api/laylo-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: `${countryCode}${phoneDigits}` }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Something went wrong");
        return;
      }
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong");
    }
  }

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
            className="relative z-10 w-full max-w-md container-organic p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-bg-raised/80 text-text-muted hover:text-text-primary hover:bg-bg-elevated flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </button>

            {status === "success" ? (
              <div className="py-6 text-center">
                <div
                  className="uppercase text-blue-300 mb-2"
                  style={{
                    fontFamily: "var(--font-heading), system-ui, sans-serif",
                    fontWeight: 900,
                    fontSize: 22,
                    letterSpacing: "0.03em",
                  }}
                >
                  You&apos;re on the list.
                </div>
                <p className="text-text-secondary text-sm">
                  We&apos;ll text you the moment new music drops.
                </p>
              </div>
            ) : (
              <>
                <div
                  className="flex items-center gap-2 uppercase mb-2"
                  style={{
                    fontFamily: "var(--font-heading), system-ui, sans-serif",
                    fontWeight: 900,
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    color: "var(--color-red-300)",
                  }}
                >
                  <span
                    className="inline-block"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--color-red-300)",
                      boxShadow: "0 0 10px var(--color-red-300)",
                    }}
                  />
                  <span>NO PRESAVES</span>
                </div>
                <h3
                  className="uppercase text-text-primary m-0 mb-2"
                  style={{
                    fontFamily: "var(--font-heading), system-ui, sans-serif",
                    fontWeight: 900,
                    fontSize: "clamp(1.5rem, 4vw, 1.875rem)",
                    lineHeight: 0.96,
                    letterSpacing: "-0.03em",
                  }}
                >
                  Just text me when it&apos;s out
                </h3>
                <p className="text-text-secondary text-sm mb-5 leading-snug">
                  Drop your number — we&apos;ll send a link the moment new music is live.
                  Standard rates apply, unsubscribe any time.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  {/* Phone input — same pattern as LeadGen Text mode */}
                  <div
                    className="flex items-center gap-2.5 border border-white/10 focus-within:border-blue-300/50 focus-within:shadow-[0_0_0_3px_rgba(124,185,232,0.18)] transition-[border-color,box-shadow]"
                    style={{
                      background: "var(--color-bg-deep)",
                      borderRadius: 999,
                    }}
                  >
                    <select
                      aria-label="Country code"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="bg-transparent border-none text-text-primary py-3 pl-4 pr-2 cursor-pointer focus:outline-none focus-visible:outline-none"
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: 14,
                        borderRight: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option
                          key={c.code}
                          value={c.code}
                          style={{ background: "var(--color-bg-deep)" }}
                        >
                          {c.code} · {c.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      required
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="(555) 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="flex-1 min-w-0 bg-transparent border-none text-text-primary text-[15px] py-3 pr-4 focus:outline-none focus-visible:outline-none"
                      style={{
                        fontFamily: "var(--font-body), system-ui, sans-serif",
                        fontWeight: 500,
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="w-full flex items-center justify-center gap-2.5 uppercase disabled:opacity-50 disabled:cursor-not-allowed py-3 px-5 text-[14px]"
                    style={{
                      border: "none",
                      cursor: "pointer",
                      background: "var(--color-blue-300)",
                      color: "var(--color-bg-deep)",
                      fontFamily: "var(--font-heading), system-ui, sans-serif",
                      fontWeight: 900,
                      letterSpacing: "0.06em",
                      borderRadius: 999,
                    }}
                  >
                    {status === "loading" ? "Subscribing…" : "Get Text Updates"}
                    <ArrowIcon size={16} />
                  </button>

                  {status === "error" && (
                    <p className="text-red-400 text-sm" role="alert">
                      {errorMsg}
                    </p>
                  )}
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
