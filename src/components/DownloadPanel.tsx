"use client";

import { useEffect, useState } from "react";
import type { Track } from "@/lib/types";

export default function DownloadPanel({
  sessionId,
  tracks,
  releaseArtist,
}: {
  sessionId: string;
  tracks: Track[];
  releaseArtist: string;
}) {
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function verify() {
      const res = await fetch("/api/verify-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      setVerified(data.valid);
      setChecking(false);
    }
    verify();
  }, [sessionId]);

  if (checking) {
    return <p className="text-text-secondary">Verifying purchase...</p>;
  }

  if (!verified) {
    return (
      <p className="text-red-400">
        Could not verify purchase. Please contact us if this is an error.
      </p>
    );
  }

  const downloadableTracks = tracks
    .filter((t) => t.audioUrl)
    .sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));

  async function downloadAll() {
    for (const track of downloadableTracks) {
      const a = document.createElement("a");
      a.href = track.audioUrl + "?dl=";
      a.download = `${track.trackArtist || releaseArtist} - ${track.title}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return (
    <div>
      <button
        onClick={downloadAll}
        className="inline-flex items-center gap-2 px-8 py-3 bg-blue-300 text-bg-deep font-bold text-base rounded-sm hover:bg-blue-200 hover:shadow-[0_0_20px_rgba(124,185,232,0.15)] transition-colors mb-8"
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
        {downloadableTracks.length > 1
          ? `Download All ${downloadableTracks.length} Tracks (WAV)`
          : "Download WAV"}
      </button>

      <div className="border border-blue-300/10 rounded-sm overflow-hidden text-left max-w-md mx-auto">
        {downloadableTracks.map((track, i) => (
          <a
            key={i}
            href={track.audioUrl + "?dl="}
            download={`${track.trackArtist || releaseArtist} - ${track.title}.wav`}
            className="flex items-center gap-3 px-4 py-3 border-b border-blue-300/5 last:border-b-0 hover:bg-bg-elevated transition-colors"
          >
            <span className="text-text-muted text-sm w-6 text-center" data-label>
              {track.trackNumber || i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary truncate">{track.title}</p>
              {track.trackArtist && (
                <p className="text-xs text-text-secondary truncate">
                  {track.trackArtist}
                </p>
              )}
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-blue-300 shrink-0"
            >
              <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  );
}
