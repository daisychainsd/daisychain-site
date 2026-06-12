"use client";

import { Fragment, useEffect, useRef, useState } from "react";

interface NewsMarqueeProps {
  items?: string[];
}

const DEFAULT_ITEMS = [
  "JUN 5 — PLAYER DAVE",
  "SPIN NIGHTCLUB · SD",
  "DAISY CHAIN #29",
  "DCR#22 BALLERINA",
  "DAISY CHAIN MAIL",
];

export default function NewsMarquee({ items = DEFAULT_ITEMS }: NewsMarqueeProps) {
  const sectionRef = useRef<HTMLElement>(null);
  // Pause the two big GPU-composited marquee layers when the section scrolls
  // out of view, so the compositor isn't re-tiling them every frame while the
  // user scrolls the rest of the page. Unlike `content-visibility: auto` (which
  // froze the marquee in prod), animation-play-state resumes cleanly.
  const [running, setRunning] = useState(true);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setRunning(entry.isIntersecting),
      { rootMargin: "100px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const playState = running ? "running" : "paused";

  // Date pinned to the label's timezone so server and client render the same
  // string (no hydration mismatch) and it's correct for San Diego viewers.
  const today = new Date()
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Los_Angeles",
    })
    .toUpperCase();

  // Tripled so the 33.333% keyframe creates a seamless loop
  const tripled = [...items, ...items, ...items];

  return (
    <section
      ref={sectionRef}
      className="relative py-9 overflow-hidden"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "var(--color-bg-abyss)",
      }}
    >
      {/* Kicker row */}
      <div className="max-w-[1440px] mx-auto flex justify-between flex-wrap gap-4 pb-4" style={{ padding: "0 clamp(24px, 4vw, 48px) 18px" }}>
        <div className="flex items-center gap-2.5">
          <span
            className="inline-block"
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--color-blue-300)",
              boxShadow: "0 0 10px var(--color-blue-300)",
            }}
          />
          <span
            style={{
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-mono), monospace",
              fontSize: 12,
              letterSpacing: "0.06em",
            }}
          >
            Dispatch · {today}
          </span>
        </div>
      </div>

      {/* Primary marquee — solid fill */}
      <div
        className="overflow-hidden whitespace-nowrap py-0.5"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="inline-flex items-center will-change-transform"
          style={{
            gap: "0.3em",
            animation: "dcMarquee 42s linear infinite",
            animationPlayState: playState,
            // Force GPU compositing on mobile Safari/Chrome — without this,
            // the animation can stutter or appear frozen at first paint.
            transform: "translateZ(0)",
            backfaceVisibility: "hidden",
          }}
        >
          {tripled.map((t, i) => (
            <Fragment key={i}>
              <span
                className="uppercase text-text-primary"
                style={{
                  // Rubik Mono One via --font-wordmark — chunky square-cornered display face,
                  // matches the DS marquee reference. Don't swap to --font-heading.
                  fontFamily: "var(--font-wordmark), sans-serif",
                  fontSize: "clamp(2rem, 6vw, 5.5rem)",
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  padding: "0 0.2em",
                }}
              >
                {t}
              </span>
              <span
                style={{
                  color: "var(--color-blue-300)",
                  fontSize: "clamp(1.25rem, 3vw, 2.5rem)",
                  padding: "0 0.3em",
                }}
              >
                ✦
              </span>
            </Fragment>
          ))}
        </div>
      </div>

      {/* Secondary marquee — outlined, reversed */}
      <div
        className="overflow-hidden whitespace-nowrap py-0.5 mt-2.5"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          opacity: 0.35,
        }}
      >
        <div
          className="inline-flex items-center will-change-transform"
          style={{
            gap: "0.3em",
            animation: "dcMarquee 55s linear infinite reverse",
            animationPlayState: playState,
            transform: "translateZ(0)",
            backfaceVisibility: "hidden",
          }}
        >
          {tripled.map((t, i) => (
            <Fragment key={i}>
              <span
                className="uppercase"
                style={{
                  fontFamily: "var(--font-wordmark), sans-serif",
                  fontSize: "clamp(2rem, 6vw, 5.5rem)",
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  padding: "0 0.2em",
                  WebkitTextStroke: "1px var(--color-text-primary)",
                  color: "transparent",
                }}
              >
                {t}
              </span>
              <span
                style={{
                  color: "var(--color-blue-300)",
                  fontSize: "clamp(1.25rem, 3vw, 2.5rem)",
                  padding: "0 0.3em",
                }}
              >
                ·
              </span>
            </Fragment>
          ))}
        </div>
      </div>

    </section>
  );
}
