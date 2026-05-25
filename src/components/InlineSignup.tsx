"use client";

import { useState } from "react";
import { ArrowIcon } from "@/components/icons";

interface InlineSignupProps {
  headline: string;
  campaign: string;
}

export default function InlineSignup({ headline, campaign }: InlineSignupProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, campaign }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3 mb-9"
        style={{
          borderRadius: "var(--radius-organic-sm)",
          background: "rgba(124,185,232,0.06)",
          border: "1px solid rgba(124,185,232,0.15)",
        }}
      >
        <span
          className="inline-block"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--color-blue-300)",
            flexShrink: 0,
          }}
        />
        <span
          className="text-blue-300"
          style={{
            fontFamily: "var(--font-heading), system-ui, sans-serif",
            fontWeight: 900,
            fontSize: 12,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          You're on Chain Mail.
        </span>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-4 py-3 mb-9"
      style={{
        borderRadius: "var(--radius-organic-sm)",
        background: "var(--color-bg-surface)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
        <span
          className="inline-block flex-shrink-0"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--color-red-300)",
            boxShadow: "0 0 8px var(--color-red-300)",
            animation: "dcPulse 2s ease-in-out infinite",
          }}
        />
        <span
          className="text-text-secondary whitespace-nowrap"
          style={{
            fontFamily: "var(--font-heading), system-ui, sans-serif",
            fontWeight: 900,
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {headline}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          className="flex items-center flex-1 min-w-0 border border-white/6 focus-within:border-blue-300/50 focus-within:shadow-[0_0_0_3px_rgba(124,185,232,0.18)] transition-[border-color,box-shadow]"
          style={{
            background: "var(--color-bg-deep)",
            borderRadius: 999,
          }}
        >
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 min-w-0 bg-transparent border-none text-text-primary text-[13px] py-2 pl-3.5 pr-2 focus:outline-none focus-visible:outline-none"
            style={{
              fontFamily: "var(--font-body), system-ui, sans-serif",
              fontWeight: 500,
            }}
          />
        </div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="flex items-center gap-1.5 uppercase disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0 px-3.5 py-2"
          style={{
            border: "none",
            cursor: "pointer",
            background: "var(--color-blue-300)",
            color: "var(--color-bg-deep)",
            fontFamily: "var(--font-heading), system-ui, sans-serif",
            fontWeight: 900,
            fontSize: 10,
            letterSpacing: "0.08em",
            borderRadius: 999,
            transition: "background-color 250ms var(--ease-daisy), box-shadow 250ms var(--ease-daisy)",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "var(--color-blue-200)";
            e.currentTarget.style.boxShadow = "0 0 16px rgba(124,185,232,0.2)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "var(--color-blue-300)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {status === "loading" ? "Joining\u2026" : "Join"}
          <ArrowIcon size={12} />
        </button>
      </div>

      {status === "error" && (
        <span className="text-xs" style={{ color: "var(--color-red-300)" }}>Something went wrong</span>
      )}
    </form>
  );
}
