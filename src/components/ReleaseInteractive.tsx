"use client";

import { useState } from "react";
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
}

function isPhysical(format: string) {
  const f = format.toLowerCase();
  return f === "vinyl" || f === "cassette";
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
}: ReleaseInteractiveProps) {
  const [activeFormat, setActiveFormat] = useState(
    formats?.[0] || "digital"
  );

  const physical = isPhysical(activeFormat);
  const activePrice = physical ? physicalPrice : price;

  return (
    <div>
      {formats && formats.length > 1 && (
        <div className="mb-6">
          <FormatToggle
            formats={formats}
            activeFormat={activeFormat}
            onFormatChange={setActiveFormat}
          />
        </div>
      )}

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
    </div>
  );
}
