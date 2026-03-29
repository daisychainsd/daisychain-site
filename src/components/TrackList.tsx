"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Track } from "@/lib/types";

export default function TrackList({
  tracks,
  releaseArtist,
}: {
  tracks: Track[];
  releaseArtist: string;
}) {
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
      height: 36,
      barWidth: 1,
      barGap: 0,
      barRadius: 0,
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
    <div className="container-scoop">
      {sorted.map((track, i) => {
        const isActive = activeIndex === i;
        const showPause = isActive && isPlaying;
        const hasAudio = track.previewUrl || track.audioUrl;

        return (
          <div
            key={track.trackNumber ?? i}
            className={`flex items-center gap-4 px-4 py-3.5 border-b border-blue-300/5 last:border-b-0 hover:bg-bg-elevated transition-colors ${
              isActive
                ? "bg-blue-300/5 border-l-2 border-l-blue-300"
                : "border-l-2 border-l-transparent"
            }`}
          >
            {hasAudio ? (
              <button
                onClick={() => handlePlay(i, track)}
                className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-blue-300 transition-colors shrink-0"
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

            <div className="flex-1 min-w-0 relative">
              {isActive ? (
                <div className="relative">
                  <p className="text-[0.625rem] text-blue-300/70 font-medium leading-none mb-0.5 truncate">
                    {track.title}
                    <span className="text-text-muted"> · {track.trackArtist || releaseArtist}</span>
                  </p>
                  <div id={`waveform-${i}`} className="w-full" />
                </div>
              ) : (
                <>
                  <p className="text-base font-medium truncate text-text-primary">
                    {track.title}
                  </p>
                  <p className="text-sm text-text-secondary truncate">
                    {track.trackArtist || releaseArtist}
                  </p>
                </>
              )}
            </div>

            {track.duration && (
              <span className="text-sm text-text-muted shrink-0" data-label>
                {track.duration}
              </span>
            )}

            {track.youtubeUrl && (
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
