"use client";

import { useState } from "react";
import type { Track } from "@/lib/types";
import { downloadTracksAsZip } from "@/lib/downloadZip";

type Format = "wav" | "flac" | "aiff" | "mp3";
const FORMATS: { id: Format; label: string }[] = [
  { id: "wav", label: "WAV" },
  { id: "flac", label: "FLAC" },
  { id: "aiff", label: "AIFF" },
  { id: "mp3", label: "MP3" },
];

export default function DownloadPanel({
  tracks,
  releaseArtist,
  releaseTitle = "",
  preVerified = false,
  purchasedTrackKey = null,
}: {
  tracks: Track[];
  releaseArtist: string;
  releaseTitle?: string;
  /**
   * Set by the server page once entitlement is verified. When true, the panel
   * trusts the server and renders downloads directly — the audio URLs in
   * `tracks` are only ever sent to a verified client.
   */
  preVerified?: boolean;
  purchasedTrackKey?: string | null;
}) {
  const [format, setFormat] = useState<Format>("wav");
  const [converting, setConverting] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState<string | null>(null);

  if (!preVerified) {
    return (
      <p className="text-red-400">
        Could not verify purchase. Please contact us if this is an error.
      </p>
    );
  }

  const downloadableTracks = tracks
    .filter((t) => t.audioUrl)
    .filter((t) => !purchasedTrackKey || t._key === purchasedTrackKey)
    .sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));

  async function downloadTrack(track: Track) {
    if (!track.audioUrl) return;

    const credit =
      track.trackArtists?.map((a) => a.name).join(", ") ||
      track.trackArtist ||
      releaseArtist;
    const baseName = `${credit} - ${track.title}`;
    const trackKey = `${track.audioUrl}-${track.title}`;

    if (format === "wav") {
      const a = document.createElement("a");
      // Filename goes in the dl param — `a.download` is ignored cross-origin,
      // so Sanity's Content-Disposition decides the saved name
      a.href = `${track.audioUrl}?dl=${encodeURIComponent(`${baseName}.wav`)}`;
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

  // One zip per album — browsers block loops of programmatic downloads
  // (Brave silently dropped half the tracks), a single save always works.
  async function downloadAll() {
    if (downloadableTracks.length === 1) {
      return downloadTrack(downloadableTracks[0]);
    }
    setZipProgress(`0/${downloadableTracks.length}`);
    try {
      await downloadTracksAsZip(
        downloadableTracks.map((t, i) => ({
          audioUrl: t.audioUrl!,
          baseName: `${String(t.trackNumber || i + 1).padStart(2, "0")} ${
            t.trackArtists?.map((a) => a.name).join(", ") || t.trackArtist || releaseArtist
          } - ${t.title}`,
        })),
        format,
        `${releaseArtist} - ${releaseTitle || "Release"} (${format.toUpperCase()})`,
        (done, total) => setZipProgress(`${done}/${total}`)
      );
    } catch {
      alert("Download failed. Please try again.");
    } finally {
      setZipProgress(null);
    }
  }

  return (
    <div>
      {/* Format picker */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <span
          className="text-text-muted text-xs uppercase tracking-wider"
          data-label
        >
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
      </div>

      {format !== "wav" && (
        <p className="text-text-muted text-xs text-center mb-6">
          Converted from lossless WAV
        </p>
      )}

      <button
        onClick={() => !zipProgress && downloadAll()}
        disabled={!!zipProgress}
        className="inline-flex items-center gap-2 px-8 py-3 bg-blue-300 text-bg-deep font-bold text-base container-pill-r hover:bg-blue-200 hover:shadow-[0_0_20px_rgba(124,185,232,0.15)] transition-colors mb-8 disabled:opacity-60"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10" />
        </svg>
        {zipProgress
          ? `Preparing zip… ${zipProgress}`
          : downloadableTracks.length > 1
            ? `Download All ${downloadableTracks.length} Tracks (${format.toUpperCase()})`
            : `Download ${format.toUpperCase()}`}
      </button>

      <div className="border border-blue-300/10 rounded-sm overflow-hidden text-left max-w-md mx-auto">
        {downloadableTracks.map((track, i) => {
          const trackKey = `${track.audioUrl}-${track.title}`;
          const isConverting = converting === trackKey;

          return (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 border-b border-blue-300/5 last:border-b-0 hover:bg-bg-elevated transition-colors"
            >
              <span
                className="text-text-muted text-sm w-6 text-center"
                data-label
              >
                {track.trackNumber || i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">
                  {track.title}
                </p>
                {(track.trackArtists?.length || track.trackArtist) && (
                  <p className="text-xs text-text-secondary truncate">
                    {track.trackArtists?.length
                      ? track.trackArtists.map((a) => a.name).join(", ")
                      : track.trackArtist}
                  </p>
                )}
              </div>
              <button
                onClick={() => !isConverting && downloadTrack(track)}
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
                      className="text-blue-300"
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
      </div>

      {/* Account upsell */}
      <div className="mt-10 container-organic p-6 border border-blue-300/10 bg-[rgba(124,185,232,0.04)]">
        <p
          className="text-label text-xs uppercase tracking-wider text-text-muted mb-3"
          data-label
        >
          YOUR PURCHASE
        </p>
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          Create a free account to re-download this release anytime, in any format. Your purchases are saved automatically.
        </p>
        <ul className="text-text-muted text-xs space-y-1.5 mb-5">
          <li>Re-download anytime</li>
          <li>Track every release you own</li>
          <li>Unlimited pass option</li>
        </ul>
        <a
          href="/signup"
          className="inline-block container-pill-r bg-blue-300 text-bg-deep font-semibold text-sm px-6 py-3"
        >
          Create Free Account
        </a>
      </div>
    </div>
  );
}
