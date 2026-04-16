"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Track } from "@/lib/types";

export default function TrackList({
  tracks,
  releaseArtist,
  releaseStatus,
}: {
  tracks: Track[];
  releaseArtist: string;
  releaseStatus?: string;
}) {
  const lockAll = releaseStatus === "upcoming";
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const wsRef = useRef<any>(null);
  const mediaRef = useRef<HTMLAudioElement | null>(null);
  const WaveSurferMod = useRef<any>(null);

  useEffect(() => {
    import("wavesurfer.js").then((mod) => {
      WaveSurferMod.current = mod.default;
    });
  }, []);

  const destroy = useCallback(() => {
    if (mediaRef.current) {
      mediaRef.current.pause();
      mediaRef.current.src = "";
      mediaRef.current.load();
      mediaRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.destroy();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => destroy();
  }, [destroy]);

  function initWavesurfer(container: HTMLElement, url: string) {
    destroy();
    const WS = WaveSurferMod.current;
    if (!WS) return;

    const ws = WS.create({
      container,
      url,
      height: 40,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      waveColor: "#1F2A3A",
      progressColor: "#7CB9E8",
      cursorColor: "transparent",
      normalize: true,
      hideScrollbar: true,
      interact: true,
    });
    ws.on("finish", () => setIsPlaying(false));
    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("ready", () => ws.play());
    wsRef.current = ws;
  }

  function handlePlay(index: number, track: Track) {
    if (lockAll || track.comingSoon) return;
    if (activeIndex === index) {
      wsRef.current?.playPause();
      return;
    }

    const streamUrl = track.previewUrl || track.audioUrl;
    if (!streamUrl) return;

    setActiveIndex(index);
    setIsPlaying(true);

    requestAnimationFrame(() => {
      const el = document.getElementById(`waveform-${index}`);
      if (el) initWavesurfer(el, streamUrl);
    });
  }

  const sorted = [...tracks].sort(
    (a, b) => (a.trackNumber || 0) - (b.trackNumber || 0)
  );

  return (
    <div className="container-scoop" role="region" aria-label="Audio player">
      {sorted.map((track, i) => {
        const isActive = activeIndex === i;
        const showPause = isActive && isPlaying;
        const locked = lockAll || !!track.comingSoon;
        const hasAudio = !locked && (track.previewUrl || track.audioUrl);

        return (
          <div
            key={track.trackNumber ?? i}
            className={`flex items-center gap-4 px-4 py-3.5 border-b border-blue-300/5 last:border-b-0 transition-colors ${
              locked ? "" : "hover:bg-bg-elevated"
            } ${
              isActive
                ? "bg-blue-300/5 border-l-2 border-l-blue-300"
                : "border-l-2 border-l-transparent"
            }`}
          >
            {locked ? (
              <span
                className="w-10 h-10 flex items-center justify-center text-text-muted shrink-0"
                aria-label={`${track.title} — coming soon, not streamable`}
                title="Coming soon"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </span>
            ) : hasAudio ? (
              <button
                onClick={() => handlePlay(i, track)}
                aria-label={showPause ? `Pause ${track.title}` : `Play ${track.title}`}
                className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-blue-300 transition-colors shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/50"
              >
                {showPause ? (
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="3" y="2" width="4" height="12" rx="1" />
                    <rect x="9" y="2" width="4" height="12" rx="1" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4 2l10 6-10 6V2z" />
                  </svg>
                )}
              </button>
            ) : (
              <span className="w-10 text-center text-text-muted text-sm shrink-0" data-label>
                {track.trackNumber || i + 1}
              </span>
            )}

            <div className="flex-1 min-w-0">
              {isActive && !locked ? (
                <div className="flex items-center gap-3">
                  <div className="shrink-0 max-w-[45%] min-w-0">
                    <p className="text-base font-medium truncate text-blue-300">
                      {track.title}
                    </p>
                    <p className="text-sm text-text-secondary truncate">
                      {track.trackArtist || releaseArtist}
                    </p>
                  </div>
                  <div id={`waveform-${i}`} className="flex-1 min-w-0" />
                </div>
              ) : (
                <>
                  <p
                    className={`text-base font-medium truncate ${
                      locked ? "text-text-secondary" : "text-text-primary"
                    }`}
                  >
                    {track.title}
                  </p>
                  <p className="text-sm text-text-secondary truncate">
                    {track.trackArtist || releaseArtist}
                  </p>
                </>
              )}
            </div>

            {locked && (
              <span className="shrink-0 rounded-full bg-blue-300/10 border border-blue-300/30 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-blue-300 select-none">
                Coming Soon
              </span>
            )}

            {!locked && track.duration && (
              <span className="text-sm text-text-muted shrink-0" data-label>
                {track.duration}
              </span>
            )}

            {!locked && track.youtubeUrl && (
              <a
                href={track.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 flex items-center justify-center text-text-muted hover:text-red-400 transition-colors shrink-0"
                title={`Watch ${track.title} on YouTube`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
