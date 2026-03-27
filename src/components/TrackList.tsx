"use client";

import { useState, useRef } from "react";
import type { Track } from "@/lib/types";

export default function TrackList({
  tracks,
  releaseArtist,
  releaseTitle,
  releaseId,
  releaseSlug,
  price,
}: {
  tracks: Track[];
  releaseArtist: string;
  releaseTitle: string;
  releaseId?: string;
  releaseSlug?: string;
  price?: number;
}) {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const downloadableTracks = tracks.filter((t) => t.audioUrl);
  const hasMultipleTracks = downloadableTracks.length > 1;

  function handlePlay(index: number, url: string) {
    if (playingIndex === index) {
      if (audioRef.current?.paused) {
        audioRef.current.play();
      } else {
        audioRef.current?.pause();
      }
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    const audio = new Audio(url);
    audio.play();
    audio.onended = () => setPlayingIndex(null);
    audioRef.current = audio;
    setPlayingIndex(index);
  }

  const [buying, setBuying] = useState(false);

  async function handleBuy() {
    setBuying(true);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        releaseId,
        title: releaseTitle,
        artist: releaseArtist,
        price,
        slug: releaseSlug,
      }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
    setBuying(false);
  }

  async function handleDownloadAll() {
    for (const track of downloadableTracks) {
      const a = document.createElement("a");
      a.href = track.audioUrl + "?dl=";
      a.download = `${track.trackArtist || releaseArtist} - ${track.title}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Small delay between downloads so browser doesn't block them
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return (
    <div>
      <div className="container-scoop">
        {tracks
          .sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0))
          .map((track, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 px-4 py-3 border-b border-blue-300/5 last:border-b-0 hover:bg-bg-elevated transition-colors ${
                playingIndex === i
                  ? "bg-blue-300/5 border-l-2 border-l-blue-300"
                  : "border-l-2 border-l-transparent"
              }`}
            >
              {track.audioUrl ? (
                <button
                  onClick={() => handlePlay(i, track.audioUrl!)}
                  className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-blue-300 transition-colors shrink-0"
                >
                  {playingIndex === i ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <rect x="3" y="2" width="4" height="12" rx="1" />
                      <rect x="9" y="2" width="4" height="12" rx="1" />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M4 2l10 6-10 6V2z" />
                    </svg>
                  )}
                </button>
              ) : (
                <span className="w-8 text-center text-text-muted text-sm shrink-0" data-mono>
                  {track.trackNumber || i + 1}
                </span>
              )}

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium truncate ${
                    playingIndex === i ? "text-blue-300" : "text-text-primary"
                  }`}
                >
                  {track.title}
                </p>
                {track.trackArtist && (
                  <p className="text-xs text-text-secondary truncate">
                    {track.trackArtist}
                  </p>
                )}
              </div>

              {track.duration && (
                <span className="text-xs text-text-muted shrink-0" data-mono>
                  {track.duration}
                </span>
              )}

              {track.audioUrl && (
                <a
                  href={track.audioUrl + "?dl="}
                  download={`${track.trackArtist || releaseArtist} - ${track.title}.wav`}
                  className="text-text-muted hover:text-blue-300 transition-colors shrink-0"
                  title={`Download ${track.title}`}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10" />
                  </svg>
                </a>
              )}
            </div>
          ))}
      </div>

      {/* Buy / Download buttons */}
      {downloadableTracks.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-6">
          {price && price > 0 ? (
            <button
              onClick={handleBuy}
              disabled={buying}
              className="container-pill-r flex items-center gap-2 px-6 py-2.5 bg-blue-300 text-bg-deep font-medium text-sm hover:bg-blue-200 hover:shadow-[0_0_20px_rgba(124,185,232,0.15)] transition-all disabled:opacity-50"
            >
              {buying ? "Redirecting..." : `Buy ${hasMultipleTracks ? "EP" : "Track"} — $${price.toFixed(2)}`}
            </button>
          ) : (
            <button
              onClick={handleDownloadAll}
              className="container-pill-r flex items-center gap-2 px-5 py-2.5 bg-blue-300 text-bg-deep font-medium text-sm hover:bg-blue-200 hover:shadow-[0_0_20px_rgba(124,185,232,0.15)] transition-all"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10" />
              </svg>
              {hasMultipleTracks
                ? `Download All (${downloadableTracks.length} tracks)`
                : "Download WAV"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
