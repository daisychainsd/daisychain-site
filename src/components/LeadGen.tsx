"use client";

import { useState } from "react";
import { ArrowIcon } from "@/components/icons";

export default function LeadGen({ subscriberCount = "on chain" }: { subscriberCount?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
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
    <form
      onSubmit={handleSubmit}
      className="relative overflow-hidden grid grid-cols-1 md:grid-cols-[1.2fr_1fr] items-center gap-4 sm:gap-7 p-4 sm:p-8"
      style={{
        borderRadius: "var(--radius-organic-lg)",
        background:
          "radial-gradient(ellipse 70% 80% at 15% 100%, rgba(124,185,232,0.1), transparent 60%)," +
          "radial-gradient(ellipse 60% 70% at 100% 0%, rgba(245,110,110,0.05), transparent 55%)," +
          "var(--color-bg-surface)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Left column — copy + ticks */}
      <div className="min-w-0">
        <div
          className="flex items-center gap-2 uppercase"
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
              animation: "dcPulse 2s ease-in-out infinite",
            }}
          />
          <span>CHAIN MAIL · INSIDER LIST</span>
        </div>
        <h3
          className="uppercase text-text-primary m-0 mt-2 mb-3"
          style={{
            fontFamily: "var(--font-heading), system-ui, sans-serif",
            fontWeight: 900,
            fontSize: "clamp(1.4rem, 4.5vw, 2.5rem)",
            lineHeight: 0.96,
            letterSpacing: "-0.03em",
          }}
        >
          Bypass the{" "}
          <em
            style={{
              fontStyle: "normal",
              fontFamily: "var(--font-wordmark), sans-serif",
              color: "var(--color-blue-300)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
            }}
          >
            algorithm
          </em>
        </h3>
        <ul className="list-none p-0 m-0 grid gap-2">
          <li className="flex items-start gap-2.5 text-sm text-text-primary leading-snug">
            <Tick hot />
            <span>
              <b className="text-offwhite font-bold" style={{ color: "var(--color-offwhite)" }}>
                100% of what we drop.
              </b>
            </span>
          </li>
          <li className="flex items-start gap-2.5 text-sm text-text-primary leading-snug">
            <Tick />
            <span>
              <b className="text-offwhite font-bold" style={{ color: "var(--color-offwhite)" }}>
                Early access
              </b>{" "}
              on everything.
            </span>
          </li>
        </ul>
      </div>

      {/* Right column — form or success */}
      <div
        className="min-w-0 flex flex-col gap-2 sm:gap-2.5 p-3 sm:p-5"
        style={{
          borderRadius: "var(--radius-organic-inv-md)",
          background: "var(--color-bg-raised)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {status === "success" ? (
          <div
            className="py-3 px-4 text-center"
            style={{
              borderRadius: "var(--radius-organic-inv-md)",
              background: "rgba(124,185,232,0.08)",
              border: "1px solid rgba(124,185,232,0.3)",
            }}
          >
            <div
              className="uppercase text-blue-300"
              style={{
                fontFamily: "var(--font-heading), system-ui, sans-serif",
                fontWeight: 900,
                fontSize: 18,
                letterSpacing: "0.04em",
              }}
            >
              You&apos;re on Chain Mail.
            </div>
            <div className="text-text-secondary text-sm mt-1">We&apos;ll keep you posted.</div>
          </div>
        ) : (
          <>
            <div
              className="flex justify-between items-baseline uppercase"
              style={{
                fontFamily: "var(--font-label), system-ui, sans-serif",
                fontWeight: 900,
                fontSize: 11,
                color: "var(--color-text-muted)",
                letterSpacing: "0.08em",
              }}
            >
              <span>Your email</span>
              <span
                className="normal-case"
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 10,
                  color: "var(--color-blue-300)",
                  letterSpacing: 0,
                  textTransform: "none",
                }}
              >
                {subscriberCount}
              </span>
            </div>
            <div
              className="flex items-center gap-2.5 px-4"
              style={{
                background: "var(--color-bg-deep)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 999,
              }}
            >
              <span
                style={{
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 13,
                }}
              >
                @
              </span>
              <input
                type="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 min-w-0 bg-transparent border-none outline-none text-text-primary text-[15px] py-3.5"
                style={{
                  fontFamily: "var(--font-body), system-ui, sans-serif",
                  fontWeight: 500,
                }}
              />
            </div>
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full flex items-center justify-center gap-2.5 uppercase disabled:opacity-50 disabled:cursor-not-allowed py-2.5 px-4 sm:py-3.5 sm:px-5 text-[13px] sm:text-[14px]"
              style={{
                border: "none",
                cursor: "pointer",
                background: "var(--color-blue-300)",
                color: "var(--color-bg-deep)",
                fontFamily: "var(--font-heading), system-ui, sans-serif",
                fontWeight: 900,
                letterSpacing: "0.06em",
                borderRadius: 999,
                transition: "background-color 250ms var(--ease-daisy), box-shadow 250ms var(--ease-daisy)",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "var(--color-blue-200)";
                e.currentTarget.style.boxShadow = "0 0 24px rgba(124,185,232,0.25)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "var(--color-blue-300)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {status === "loading" ? "Joining…" : "Join Chain Mail"}
              <ArrowIcon size={16} />
            </button>
            {status === "error" && (
              <p className="text-red-400 text-sm mt-1" role="alert">
                {errorMsg}
              </p>
            )}
          </>
        )}
        <div
          className="flex justify-between gap-3 items-center mt-1.5 pt-3"
          style={{
            borderTop: "1px dashed rgba(255,255,255,0.06)",
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10,
            color: "var(--color-text-muted)",
          }}
        >
          <span>Unsubscribe any time</span>
          <span>privacy respected</span>
        </div>
      </div>
    </form>
  );
}

function Tick({ hot = false }: { hot?: boolean }) {
  return (
    <span
      className="flex-none inline-flex items-center justify-center"
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        marginTop: 1,
        fontSize: 11,
        background: hot ? "rgba(245,110,110,0.1)" : "rgba(124,185,232,0.1)",
        border: `1px solid ${hot ? "rgba(245,110,110,0.3)" : "rgba(124,185,232,0.25)"}`,
        color: hot ? "var(--color-red-300)" : "var(--color-blue-300)",
      }}
    >
      ✓
    </span>
  );
}
