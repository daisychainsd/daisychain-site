"use client";

import { useState, useRef } from "react";
import type { Track } from "@/lib/types";

export default function TrackList({
  tracks,
  releaseArtist,
}: {
  tracks: Track[];
  releaseArtist: string;
}) {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  return (
    <div>
      <div className="container-scoop">
        {tracks
          .sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0))
          .map((track, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 px-4 py-3.5 border-b border-blue-300/5 last:border-b-0 hover:bg-bg-elevated transition-colors ${
                playingIndex === i
                  ? "bg-blue-300/5 border-l-2 border-l-blue-300"
                  : "border-l-2 border-l-transparent"
              }`}
            >
              {track.audioUrl ? (
                <button
                  onClick={() => handlePlay(i, track.audioUrl!)}
                  className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-blue-300 transition-colors shrink-0"
                >
                  {playingIndex === i ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <rect x="3" y="2" width="4" height="12" rx="1" />
                      <rect x="9" y="2" width="4" height="12" rx="1" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M4 2l10 6-10 6V2z" />
                    </svg>
                  )}
                </button>
              ) : (
                <span className="w-10 text-center text-text-muted text-sm shrink-0" data-mono>
                  {track.trackNumber || i + 1}
                </span>
              )}

              <div className="flex-1 min-w-0">
                <p
                  className={`text-base font-medium truncate ${
                    playingIndex === i ? "text-blue-300" : "text-text-primary"
                  }`}
                >
                  {track.title}
                </p>
                <p className="text-sm text-text-secondary truncate">
                  {track.trackArtist || releaseArtist}
                </p>
              </div>

              {track.duration && (
                <span className="text-sm text-text-muted shrink-0" data-mono>
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
          ))}
      </div>

    </div>
  );
}
