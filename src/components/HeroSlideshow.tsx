"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface HeroSlide {
  label: string;
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
  const slides: HeroSlide[] = [];

  if (latestRelease) {
    const displayTitle = latestRelease.releaseType &&
      ["ep", "album"].includes(latestRelease.releaseType)
      ? latestRelease.title.replace(/\s+(EP|Album)$/i, "")
      : latestRelease.title;

    slides.push({
      label: "Latest Release",
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

    slides.push({
      label: "Upcoming Event",
      title: nextEvent.title,
      subtitle: `${eventDate} — ${venueName}`,
      imageUrl: nextEvent.flyerUrl,
      href: nextEvent.ticketUrl || `/events`,
      cta: "Get Tickets",
      external: !!nextEvent.ticketUrl,
    });
  }

  if (shopImageUrl) {
    slides.push({
      label: "Merch",
      title: "Shop Daisy Chain",
      subtitle: "Vinyl, tees, accessories",
      imageUrl: shopImageUrl,
      href: "/shop",
      cta: "Browse Shop",
    });
  }

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const advance = useCallback(() => {
    if (slides.length <= 1) return;
    setActive((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const id = setInterval(advance, 6000);
    return () => clearInterval(id);
  }, [paused, advance, slides.length]);

  if (slides.length === 0) return null;

  return (
    <section
      className="relative w-full h-[70vh] max-h-[700px] min-h-[400px] overflow-hidden -mt-24"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {slides.map((slide, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === active ? "opacity-100 z-10" : "opacity-0 z-0"
          }`}
          aria-hidden={i !== active}
        >
          {/* Background image */}
          <img
            src={slide.imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-bg-abyss via-bg-abyss/50 to-bg-abyss/20" />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-end p-6 pb-16 sm:p-10 sm:pb-20 md:p-16 md:pb-24 max-w-7xl mx-auto">
            <p className="text-blue-300 text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase mb-2 sm:mb-3">
              {slide.label}
            </p>
            <h2 className="text-headline text-text-primary mb-1 sm:mb-2 max-w-lg">
              {slide.title}
            </h2>
            <p className="text-text-secondary text-base sm:text-lg mb-5 sm:mb-6">
              {slide.subtitle}
            </p>
            {slide.external ? (
              <a
                href={slide.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 w-fit px-6 py-3 rounded-full bg-blue-300 text-bg-deep text-sm font-semibold hover:bg-blue-200 transition-colors duration-200"
              >
                {slide.cta}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </a>
            ) : (
              <Link
                href={slide.href}
                className="inline-flex items-center gap-2 w-fit px-6 py-3 rounded-full bg-blue-300 text-bg-deep text-sm font-semibold hover:bg-blue-200 transition-colors duration-200"
              >
                {slide.cta}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            )}
          </div>
        </div>
      ))}

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-5 sm:bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === active
                  ? "bg-white w-6"
                  : "bg-white/40 hover:bg-white/60"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
