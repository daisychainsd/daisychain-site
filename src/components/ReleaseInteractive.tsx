"use client";

import { Fragment, useState } from "react";
import FormatToggle from "./FormatToggle";
import TrackList from "./TrackList";
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
  const [activeFormat, setActiveFormat] = useState(
    formats?.[0] || "digital"
  );

  const physical = isPhysical(activeFormat);
  const activePrice = physical ? physicalPrice : price;
  const hasToggle = formats && formats.length > 1;

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
          <div className="flex flex-col justify-center p-4 sm:p-6">
            <p className="text-label mb-3">
              {catalogNumber}
              {releaseType && (
                <span className="ml-2 text-blue-300/70">
                  {releaseType}
                </span>
              )}
            </p>
            <h1 className="text-headline mb-2">{releaseTitle}</h1>
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
              ) : (
                <a
                  href={`/artists/${artistSlug}`}
                  className="text-blue-300 hover:underline"
                >
                  {releaseArtist}
                </a>
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

            {hasToggle && (
              <div className="mb-4">
                <FormatToggle
                  formats={formats}
                  activeFormat={activeFormat}
                  onFormatChange={setActiveFormat}
                />
              </div>
            )}

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

      {/* Track List */}
      {tracks.length > 0 && (
        <section className="mt-12">
          <div className="mb-4">
            <p className="text-label mb-1">Tracks</p>
            <h2 className="text-title text-text-primary">Tracklist</h2>
          </div>
          {physical && !physicalPrice ? (
            <div className="container-scoop p-6 text-center">
              <p className="text-text-secondary text-sm mb-3">
                Physical format coming soon
              </p>
              <button
                disabled
                className="container-pill-r px-6 py-2.5 bg-blue-300/20 text-blue-300/40 font-medium text-sm cursor-not-allowed"
              >
                Coming Soon
              </button>
            </div>
          ) : (
            <TrackList
              tracks={tracks}
              releaseArtist={releaseArtist}
              releaseTitle={releaseTitle}
              releaseId={releaseId}
              releaseSlug={releaseSlug}
              price={activePrice}
              formatMode={physical ? "physical" : "digital"}
            />
          )}
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
