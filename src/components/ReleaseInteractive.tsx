"use client";

import { Fragment, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import FormatToggle from "./FormatToggle";
import TrackList from "./TrackList";
import { createClient } from "@/lib/supabase/client";
import type { Track } from "@/lib/types";

interface ReleaseInteractiveProps {
  formats?: string[];
  price?: number;
  physicalPrice?: number;
  tracks: Track[];
  releaseArtist: string;
  releaseTitle: string;
  releaseId?: string;
  releaseSlug?: string;
  artistSlug?: string;
  primaryArtistName?: string;
  additionalArtists?: { name: string; slug: string }[];
  remixerSlug?: string;
  catalogNumber?: string;
  releaseType?: string;
  releaseDate?: string;
  coverUrl?: string;
  embedUrl?: string;
}

function isPhysical(format: string) {
  const f = format.toLowerCase();
  return f === "vinyl" || f === "cd" || f === "cassette";
}

export default function ReleaseInteractive({
  formats,
  price,
  physicalPrice,
  tracks,
  releaseArtist,
  releaseTitle,
  releaseId,
  releaseSlug,
  artistSlug,
  primaryArtistName,
  additionalArtists,
  remixerSlug,
  catalogNumber,
  releaseType,
  releaseDate,
  coverUrl,
  embedUrl,
}: ReleaseInteractiveProps) {
  const router = useRouter();

  const [activeFormat, setActiveFormat] = useState(
    formats?.[0] || "digital"
  );
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, []);

  const physical = isPhysical(activeFormat);
  const activePrice = physical ? physicalPrice : price;
  const hasToggle = formats && formats.length > 1;

  const displayTitle = releaseType && ["ep", "album"].includes(releaseType)
    ? releaseTitle.replace(/\s+(EP|Album)$/i, "")
    : releaseTitle;

  const hasMultipleTracks = tracks.length > 1;
  const [buying, setBuying] = useState(false);

  async function handleBuy() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/releases/${releaseSlug}`);
      return;
    }

    setBuying(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          releaseId,
          title: releaseTitle,
          artist: releaseArtist,
          price: activePrice,
          slug: releaseSlug,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setBuying(false);
    }
  }


  return (
    <div>
      {/* Cover + Metadata in one organic container */}
      <div className="container-organic p-3 sm:p-4">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Cover Art — inset container */}
          <div className="container-inset aspect-square max-h-[70vw] md:max-h-none relative">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={releaseTitle}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-muted text-2xl bg-bg-raised">
                {catalogNumber}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col justify-between p-4 sm:p-6">
            <div>
            <p className="text-label mb-3">
              {catalogNumber}
              {releaseType && (
                <span className="ml-2 text-blue-300/70">
                  {releaseType}
                </span>
              )}
            </p>
            <h1 className="text-headline mb-2">{displayTitle}</h1>
            <div className="text-xl mb-4 flex flex-wrap items-baseline gap-x-1">
              {releaseType === "remix" && remixerSlug ? (
                <>
                  <a
                    href={`/artists/${remixerSlug}`}
                    className="text-blue-300 hover:underline"
                  >
                    {releaseArtist}
                  </a>
                  {artistSlug && primaryArtistName && (
                    <>
                      <span className="text-text-muted">,</span>
                      <a
                        href={`/artists/${artistSlug}`}
                        className="text-blue-300 hover:underline"
                      >
                        {primaryArtistName}
                      </a>
                    </>
                  )}
                </>
              ) : artistSlug ? (
                <a
                  href={`/artists/${artistSlug}`}
                  className="text-blue-300 hover:underline"
                >
                  {releaseArtist}
                </a>
              ) : (
                <span className="text-blue-300">{releaseArtist}</span>
              )}
              {additionalArtists?.map((a) => (
                <Fragment key={a.slug}>
                  <span className="text-text-muted">,</span>
                  <a
                    href={`/artists/${a.slug}`}
                    className="text-blue-300 hover:underline"
                  >
                    {a.name}
                  </a>
                </Fragment>
              ))}
            </div>

            </div>

            <div className="pt-4 border-t border-blue-300/10">
              {hasToggle && (
                <div className="mb-4">
                  <FormatToggle
                    formats={formats}
                    activeFormat={activeFormat}
                    onFormatChange={setActiveFormat}
                  />
                </div>
              )}

              {physical && !physicalPrice ? (
                <button
                  disabled
                  className="container-pill-r px-6 py-2.5 bg-blue-300/20 text-blue-300/40 font-medium text-sm cursor-not-allowed mb-4"
                >
                  Coming Soon
                </button>
              ) : activePrice && activePrice > 0 ? (
                <button
                  onClick={handleBuy}
                  disabled={buying}
                  className="container-pill-r flex items-center gap-2 px-6 py-2.5 bg-blue-300 text-bg-deep font-medium text-sm hover:bg-blue-200 hover:shadow-[0_0_20px_rgba(124,185,232,0.15)] transition-all disabled:opacity-50 mb-4"
                >
                  {buying ? "Redirecting..." : `Buy ${hasMultipleTracks ? releaseType || "Release" : "Track"} — $${activePrice.toFixed(2)}`}
                </button>
              ) : null}

              {releaseDate && (
                <p className="text-text-secondary text-base">
                  Released{" "}
                  {new Date(releaseDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Track List */}
      {tracks.length > 0 && (
        <section className="mt-12">
          <div className="mb-4">
            <p className="text-label mb-1">Tracks</p>
            <h2 className="text-title text-text-primary">Tracklist</h2>
          </div>
          <TrackList tracks={tracks} releaseArtist={releaseArtist} />
        </section>
      )}

      {/* Embedded Player fallback */}
      {embedUrl && (
        <section className="mt-12">
          <iframe
            src={embedUrl}
            className="w-full h-[120px] rounded-sm"
            allow="autoplay"
            title={`Listen to ${releaseTitle}`}
          />
        </section>
      )}
    </div>
  );
}
