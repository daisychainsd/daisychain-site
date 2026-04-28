"use client";

import { useEffect, useRef } from "react";
import LeadGen from "@/components/LeadGen";

export default function WordmarkHero() {
  // Scroll-driven letter-spacing is written directly to the DOM via a ref + rAF.
  // Avoids re-rendering React on every scroll tick (was causing jank on fast scrolls).
  const wordmarkRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduceMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    let rafId = 0;
    let pending = false;

    const update = () => {
      pending = false;
      const el = wordmarkRef.current;
      if (!el) return;
      const t = Math.max(-0.04, -0.04 + window.scrollY * 0.00008);
      el.style.letterSpacing = `${t}em`;
    };

    const onScroll = () => {
      if (pending) return;
      pending = true;
      rafId = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section
      className="relative mx-auto overflow-hidden"
      style={{
        padding: "clamp(16px, 3vw, 32px) clamp(24px, 4vw, 48px) 48px",
        maxWidth: 1440,
      }}
    >
      {/* Hero photo — responsive (landscape >=768px / portrait <768px).
          Grainy black-and-white dance floor imagery sits BEHIND the wordmark.
          aria-hidden + empty alt on the img to exclude the decorative photo
          from the accessibility tree. */}
      <picture>
        <source media="(min-width: 768px)" srcSet="/hero-landscape.png" />
        <img
          src="/hero-portrait.png"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover z-0"
          style={{ opacity: 0.55 }}
        />
      </picture>
      {/* Radial vignette so the wordmark + LeadGen card pop off the photo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(10,14,20,0.3) 0%, rgba(10,14,20,0.85) 75%)",
        }}
      />

      {/* Everything below stacks above the photo */}
      <div className="relative z-10">

      {/* Top kicker row */}
      <div className="flex justify-between items-start flex-wrap gap-5 mb-6">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-block"
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--color-blue-300)",
              boxShadow: "0 0 12px var(--color-blue-300)",
            }}
          />
          <span
            style={{
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-mono), monospace",
              fontSize: 12,
              letterSpacing: "0.02em",
            }}
          >
            Independent electronic music · San Diego · Est. 2021
          </span>
        </div>
      </div>

      {/* DAISY / CHAIN wordmark — Rubik Mono One via --font-wordmark.
          Rubik Mono One is a single-weight display face (weight 400) with the
          bold geometric letterforms baked into the glyphs, so we skip the
          font-weight declaration. --font-wordmark is a semantic token reserved
          specifically for this + the NewsMarquee big display type; do NOT
          swap it for --font-heading. */}
      <h1
        ref={wordmarkRef}
        className="uppercase text-text-primary text-left"
        style={{
          fontFamily: "var(--font-wordmark), sans-serif",
          fontSize: "clamp(4rem, 20vw, 22rem)",
          lineHeight: 0.82,
          margin: "4vw 0",
          letterSpacing: "-0.04em",
        }}
      >
        <span className="block">DAISY</span>
        <span className="block">CHAIN</span>
      </h1>

      {/* Inline LeadGen card */}
      <LeadGen />

      </div>
    </section>
  );
}
