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
    // Section is full-width. Photo + vignette fill the entire viewport-width
    // (no max-width). Inner content wrapper handles the 1440 max-width + padding
    // so wordmark + LeadGen card stay aligned with the rest of the page grid.
    // Bottom gradient fade bleeds the hero photo into the NewsMarquee's solid
    // bg-abyss section below for a clean handoff (no visible page bg sliver).
    <section className="relative w-full overflow-hidden">
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
      {/* Bottom edge fade — blends hero photo into the abyss-colored marquee
          immediately below. Without this, you can see the seam between the
          hero's photo and the marquee's solid background. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0"
        style={{
          height: "120px",
          background:
            "linear-gradient(to bottom, transparent 0%, var(--color-bg-abyss) 100%)",
        }}
      />

      {/* Everything below stacks above the photo. Inner wrapper constrains the
          actual content to the 1440 grid; the photo behind already fills viewport. */}
      <div
        className="relative z-10 mx-auto"
        style={{
          padding: "clamp(16px, 3vw, 32px) clamp(24px, 4vw, 48px) 48px",
          maxWidth: 1440,
        }}
      >

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
      {/* Each line is its own block so they wrap independently. The font scales
          with viewport width via clamp; the upper bounds are tuned so neither
          DAISY nor CHAIN clips against the section padding (Rubik Mono One's
          H/N/A glyphs are wide). max-width:100% + word-break belt-and-braces
          for narrow viewports. */}
      <h1
        ref={wordmarkRef}
        className="uppercase text-text-primary text-left"
        style={{
          fontFamily: "var(--font-wordmark), sans-serif",
          fontSize: "clamp(3.5rem, 16vw, 17rem)",
          lineHeight: 0.82,
          margin: "4vw 0",
          letterSpacing: "-0.04em",
          maxWidth: "100%",
          wordBreak: "break-word",
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
