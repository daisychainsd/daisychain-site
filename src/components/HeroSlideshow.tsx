"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";

const HERO_PREF_KEY = "daisychain-hero-pref";
const AUTOPLAY_MS = 3000;

const HERO_CTA_CLASS =
  "inline-flex items-center justify-center gap-1.5 min-h-10 min-w-[152px] sm:min-w-[160px] px-3 py-2 container-pill-r bg-blue-300 text-bg-deep text-sm font-semibold hover:bg-blue-200 transition-colors hover:shadow-[0_0_20px_rgba(124,185,232,0.15)]";

function HeroCtaChevron() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

interface HeroSlide {
  label: string;
  laneLabel: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  href: string;
  cta: string;
  external?: boolean;
}

interface HeroSlideshowProps {
  latestRelease?: {
    title: string;
    slug: string;
    artist: string;
    coverUrl: string;
    releaseType?: string;
  };
  nextEvent?: {
    title: string;
    slug: string;
    date: string;
    venue?: string;
    flyerUrl: string;
    ticketUrl?: string;
  };
  shopImageUrl?: string;
}

export default function HeroSlideshow({
  latestRelease,
  nextEvent,
  shopImageUrl,
}: HeroSlideshowProps) {
  const slides: HeroSlide[] = useMemo(() => {
    const list: HeroSlide[] = [];

    if (latestRelease) {
      const displayTitle =
        latestRelease.releaseType &&
        ["ep", "album"].includes(latestRelease.releaseType)
          ? latestRelease.title.replace(/\s+(EP|Album)$/i, "")
          : latestRelease.title;

      list.push({
        label: "Latest Release",
        laneLabel: "Music",
        title: displayTitle,
        subtitle: latestRelease.artist,
        imageUrl: latestRelease.coverUrl,
        href: `/releases/${latestRelease.slug}`,
        cta: "Listen Now",
      });
    }

    if (nextEvent) {
      const eventDate = new Date(nextEvent.date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      });
      const venueName = nextEvent.venue?.replace(/, .*$/, "") || "";

      list.push({
        label: "Upcoming Event",
        laneLabel: "Events",
        title: nextEvent.title,
        subtitle: `${eventDate} — ${venueName}`,
        imageUrl: nextEvent.flyerUrl,
        href: nextEvent.ticketUrl || `/events`,
        cta: "Get Tickets",
        external: !!nextEvent.ticketUrl,
      });
    }

    if (shopImageUrl) {
      list.push({
        label: "Merch",
        laneLabel: "Shop",
        title: "Shop Daisy Chain",
        subtitle: "Vinyl, tees, accessories",
        imageUrl: shopImageUrl,
        href: "/shop",
        cta: "Browse Shop",
      });
    }

    return list;
  }, [latestRelease, nextEvent, shopImageUrl]);

  const [active, setActive] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [autoplayStoppedByUser, setAutoplayStoppedByUser] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(HERO_PREF_KEY);
        if (raw != null) {
          const idx = parseInt(raw, 10);
          if (Number.isFinite(idx) && idx >= 0 && idx < slides.length) {
            setActive(idx);
          }
        }
      } catch {
        /* ignore */
      }
      setHydrated(true);
    });
  }, [slides.length]);

  const advance = useCallback(() => {
    if (slides.length <= 1) return;
    setActive((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const autoplayBlocked =
    hoverPaused || autoplayStoppedByUser || slides.length <= 1;

  useEffect(() => {
    if (!hydrated || autoplayBlocked) return;
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) return;
    const id = setInterval(advance, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [hydrated, autoplayBlocked, advance, slides.length]);

  const pickSlide = useCallback(
    (i: number, opts?: { focusLane?: boolean }) => {
      setActive(i);
      setAutoplayStoppedByUser(true);
      try {
        localStorage.setItem(HERO_PREF_KEY, String(i));
      } catch {
        /* ignore */
      }
      if (opts?.focusLane) {
        queueMicrotask(() =>
          document.getElementById(`hero-lane-${i}`)?.focus(),
        );
      }
    },
    [],
  );

  const onLaneKeyDown = useCallback(
    (e: React.KeyboardEvent, i: number) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        pickSlide((i + 1) % slides.length, { focusLane: true });
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        pickSlide((i - 1 + slides.length) % slides.length, {
          focusLane: true,
        });
      } else if (e.key === "Home") {
        e.preventDefault();
        pickSlide(0, { focusLane: true });
      } else if (e.key === "End") {
        e.preventDefault();
        pickSlide(slides.length - 1, { focusLane: true });
      }
    },
    [pickSlide, slides.length],
  );

  if (slides.length === 0) return null;

  const current = slides[active];

  const ctaContent = (
    <>
      <span className="truncate">{current.cta}</span>
      <HeroCtaChevron />
    </>
  );

  return (
    <div className="relative -mt-24 pt-24">
      <section
        className="relative w-full h-[62vh] max-h-[620px] min-h-[320px] overflow-hidden max-[480px]:min-h-[280px] [@media(max-height:500px)]:min-h-[240px]"
        onMouseEnter={() => setHoverPaused(true)}
        onMouseLeave={() => setHoverPaused(false)}
        aria-roledescription="carousel"
        aria-label="Featured highlights"
      >
        <div className="absolute inset-x-3 sm:inset-x-5 top-0 bottom-0 overflow-hidden rounded-t-2xl sm:rounded-t-3xl bg-bg-deep">
          {slides.map((slide, i) => (
            <div
              key={slide.href + slide.laneLabel}
              aria-hidden={i !== active}
              className={`absolute inset-0 transition-opacity duration-[var(--duration-hero)] ease-in-out ${
                i === active ? "opacity-100 z-0" : "opacity-0 z-0"
              }`}
            >
              <img
                src={slide.imageUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg-abyss via-bg-abyss/50 to-bg-abyss/20" />
            </div>
          ))}

          <div
            id="hero-tabpanel"
            role="tabpanel"
            aria-labelledby={
              slides.length > 1 ? `hero-lane-${active}` : undefined
            }
            className="absolute inset-0 z-10 flex flex-col justify-end pointer-events-none"
          >
            <div className="max-w-7xl mx-auto w-full p-5 pb-8 sm:p-8 sm:pb-10 md:p-12 md:pb-14 pointer-events-auto">
              <p
                className="text-blue-300 text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase mb-2 sm:mb-3"
                data-label
              >
                {current.label}
              </p>
              <h2 className="text-headline text-text-primary mb-1 sm:mb-2 max-w-lg max-[480px]:text-[clamp(1.35rem,6vw,2rem)]">
                {current.title}
              </h2>
              <p className="text-text-secondary text-base sm:text-lg mb-4 sm:mb-5 max-[480px]:text-[0.9375rem]">
                {current.subtitle}
              </p>
              {current.external ? (
                <a
                  href={current.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={HERO_CTA_CLASS}
                >
                  {ctaContent}
                </a>
              ) : (
                <Link href={current.href} className={HERO_CTA_CLASS}>
                  {ctaContent}
                </Link>
              )}

              {slides.length > 1 && (
                <nav
                  className="mt-5 pt-4 border-t border-white/10"
                  aria-label="Choose a highlight"
                >
                  <div
                    role="tablist"
                    className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:gap-x-8"
                  >
                    {slides.map((slide, i) => {
                      const isOn = i === active;
                      return (
                        <button
                          key={slide.href + slide.laneLabel}
                          type="button"
                          role="tab"
                          id={`hero-lane-${i}`}
                          tabIndex={isOn ? 0 : -1}
                          aria-selected={isOn}
                          aria-controls="hero-tabpanel"
                          onClick={() => pickSlide(i)}
                          onKeyDown={(e) => onLaneKeyDown(e, i)}
                          className={`min-h-10 py-0.5 text-left text-[0.9375rem] sm:text-base font-medium tracking-tight transition-colors border-b-2 border-transparent -mb-px ${
                            isOn
                              ? "text-text-primary border-blue-300"
                              : "text-text-secondary/90 hover:text-text-primary"
                          }`}
                        >
                          {slide.laneLabel}
                        </button>
                      );
                    })}
                  </div>
                </nav>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
