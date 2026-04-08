"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Format = "wav" | "flac" | "aiff" | "mp3";
const FORMATS: { id: Format; label: string }[] = [
  { id: "wav", label: "WAV" },
  { id: "flac", label: "FLAC" },
  { id: "aiff", label: "AIFF" },
  { id: "mp3", label: "MP3" },
];

interface Track {
  title: string;
  trackArtist?: string;
  trackNumber?: number;
  audioUrl?: string;
}

interface DownloadRelease {
  title: string;
  slug: string;
  artist: string;
  coverUrl: string;
  catalogNumber?: string;
  tracks?: Track[];
}

export default function AccountClient({
  email,
  hasUnlimitedPass,
  releases,
}: {
  email: string;
  hasUnlimitedPass: boolean;
  releases: DownloadRelease[];
}) {
  const router = useRouter();
  const [buyingPass, setBuyingPass] = useState(false);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>("wav");
  const [converting, setConverting] = useState<string | null>(null);

  async function handleSignOut() {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function handleBuyPass() {
    setBuyingPass(true);
    const res = await fetch("/api/checkout-pass", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setBuyingPass(false);
  }

  async function handleDownloadTrack(track: Track, artist: string) {
    if (!track.audioUrl) return;

    const baseName = `${track.trackArtist || artist} - ${track.title}`;
    const trackKey = `${track.audioUrl}-${track.title}`;

    if (format === "wav") {
      const a = document.createElement("a");
      a.href = track.audioUrl + "?dl=";
      a.download = `${baseName}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    setConverting(trackKey);
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: track.audioUrl,
          format,
          filename: baseName,
        }),
      });

      if (!res.ok) throw new Error("Conversion failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed. Please try again or use WAV format.");
    } finally {
      setConverting(null);
    }
  }

  async function handleDownloadAll(release: DownloadRelease) {
    const downloadable = release.tracks?.filter((t) => t.audioUrl) ?? [];
    for (const track of downloadable) {
      await handleDownloadTrack(track, release.artist);
      await new Promise((r) => setTimeout(r, format === "wav" ? 500 : 1000));
    }
  }

  return (
    <section className="min-h-[60vh] py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-label mb-2">Account</p>
            <h1 className="text-headline">Your Music</h1>
            <p className="text-text-secondary text-sm mt-2">{email}</p>
          </div>
          <div className="flex items-center gap-3">
            {hasUnlimitedPass && (
              <span className="px-3 py-1.5 bg-blue-300/10 text-blue-300 text-xs uppercase tracking-wider rounded-full border border-blue-300/20" data-label>
                Unlimited Pass
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-blue-300/10 rounded-lg hover:border-blue-300/20 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Unlimited Pass CTA */}
        {!hasUnlimitedPass && (
          <div className="container-organic p-6 sm:p-8 mb-12">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-title text-text-primary mb-1">
                  Unlimited Pass
                </h2>
                <p className="text-text-secondary text-sm max-w-lg">
                  One-time purchase of $100 for lifetime access to download
                  every Daisy Chain release — past, present, and future — in
                  any format.
                </p>
              </div>
              <button
                onClick={handleBuyPass}
                disabled={buyingPass}
                className="shrink-0 container-pill-r px-6 py-3 bg-blue-300 text-bg-deep font-medium text-sm hover:bg-blue-200 hover:shadow-[0_0_20px_rgba(124,185,232,0.15)] transition-colors disabled:opacity-50"
              >
                {buyingPass ? "Redirecting..." : "Get Unlimited — $100"}
              </button>
            </div>
          </div>
        )}

        {/* Format selector + Downloads */}
        {releases.length > 0 ? (
          <>
            {/* Format picker */}
            <div className="flex items-center gap-4 mb-6">
              <span className="text-text-muted text-xs uppercase tracking-wider" data-label>
                Format
              </span>
              <div className="container-toggle">
                {FORMATS.map((f, i) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`container-toggle-option px-3 py-1.5 text-xs rounded-full ${
                      format === f.id
                        ? `toggle-active ${i === 0 ? "toggle-first" : i === FORMATS.length - 1 ? "toggle-last" : "toggle-middle"}`
                        : ""
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {format !== "wav" && (
                <span className="text-text-muted text-xs">
                  Converted from lossless WAV
                </span>
              )}
            </div>

            <div className="space-y-4">
              {releases.map((release) => {
                const downloadable =
                  release.tracks?.filter((t) => t.audioUrl) ?? [];
                const isExpanded = expandedSlug === release.slug;

                return (
                  <div
                    key={release.slug}
                    className="container-organic overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-4 p-4 cursor-pointer hover:bg-bg-elevated/50 transition-colors"
                      onClick={() =>
                        setExpandedSlug(isExpanded ? null : release.slug)
                      }
                    >
                      <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-bg-raised">
                        {release.coverUrl ? (
                          <img
                            src={release.coverUrl}
                            alt={release.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">
                            {release.catalogNumber}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-text-primary font-semibold truncate">
                          {release.title}
                        </p>
                        <p className="text-text-secondary text-sm truncate">
                          {release.artist}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {downloadable.length > 0 && (
                          <span className="text-text-muted text-xs" data-label>
                            {downloadable.length}{" "}
                            {downloadable.length === 1 ? "track" : "tracks"}
                          </span>
                        )}
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          className={`text-text-muted transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        >
                          <path d="M4 6l4 4 4-4" />
                        </svg>
                      </div>
                    </div>

                    {isExpanded && downloadable.length > 0 && (
                      <div className="border-t border-blue-300/6">
                        {downloadable
                          .sort(
                            (a, b) =>
                              (a.trackNumber || 0) - (b.trackNumber || 0)
                          )
                          .map((track, i) => {
                            const trackKey = `${track.audioUrl}-${track.title}`;
                            const isConverting = converting === trackKey;

                            return (
                              <div
                                key={i}
                                className="flex items-center gap-4 px-4 py-3 border-b border-blue-300/5 last:border-b-0 hover:bg-bg-elevated transition-colors"
                              >
                                <span className="w-8 text-center text-text-muted text-sm shrink-0" data-label>
                                  {track.trackNumber || i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-text-primary text-sm truncate">
                                    {track.title}
                                  </p>
                                  {track.trackArtist && (
                                    <p className="text-text-secondary text-xs truncate">
                                      {track.trackArtist}
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isConverting)
                                      handleDownloadTrack(
                                        track,
                                        release.artist
                                      );
                                  }}
                                  disabled={isConverting}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-muted hover:text-blue-300 transition-colors shrink-0 disabled:opacity-50"
                                  title={`Download ${track.title} as ${format.toUpperCase()}`}
                                >
                                  {isConverting ? (
                                    <span className="text-blue-300 animate-pulse">
                                      Converting...
                                    </span>
                                  ) : (
                                    <>
                                      <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 16 16"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                      >
                                        <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10" />
                                      </svg>
                                      .{format}
                                    </>
                                  )}
                                </button>
                              </div>
                            );
                          })}

                        {downloadable.length > 1 && (
                          <div className="px-4 py-3 bg-bg-raised/50">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadAll(release);
                              }}
                              className="container-pill-r flex items-center gap-2 px-5 py-2 bg-blue-300 text-bg-deep font-medium text-xs hover:bg-blue-200 transition-colors"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10" />
                              </svg>
                              Download All as {format.toUpperCase()} (
                              {downloadable.length} tracks)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="container-organic p-12 text-center">
            <p className="text-text-secondary text-lg mb-2">
              No downloads yet
            </p>
            <p className="text-text-muted text-sm mb-6">
              Purchase a release to see your downloads here.
            </p>
            <a
              href="/"
              className="inline-block container-pill-r px-6 py-2.5 bg-blue-300 text-bg-deep font-medium text-sm hover:bg-blue-200 transition-colors"
            >
              Browse Releases
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
