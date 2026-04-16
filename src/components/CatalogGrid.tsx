"use client";

import { useState } from "react";
import FormatToggle from "./FormatToggle";
import ReleaseCard from "./ReleaseCard";

interface CatalogRelease {
  title: string;
  slug: string;
  artist: string;
  coverUrl: string;
  format?: string[];
  catalogNumber?: string;
  status?: string;
}

export default function CatalogGrid({ releases }: { releases: CatalogRelease[] }) {
  const [filter, setFilter] = useState("all");

  const hasPhysical = releases.some(
    (r) => r.format?.some((f) => f !== "digital")
  );

  const filters = hasPhysical ? ["all", "physical"] : [];

  const filtered = filter === "physical"
    ? releases.filter((r) => r.format?.some((f) => f !== "digital"))
    : releases;

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-end gap-6">
        <div>
          <p className="text-label mb-2">Catalog</p>
          <h2 className="text-headline text-text-primary">Releases</h2>
        </div>
        {filters.length > 0 && (
          <div className="mb-1">
            <FormatToggle
              formats={filters}
              activeFormat={filter}
              onFormatChange={setFilter}
            />
          </div>
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8">
          {filtered.map((release) => (
            <ReleaseCard
              key={release.slug}
              title={release.title}
              slug={release.slug}
              artist={release.artist}
              coverUrl={release.coverUrl}
              catalogNumber={release.catalogNumber}
              status={release.status}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-text-muted">
          <p className="text-lg">nothing here yet — check back soon.</p>
        </div>
      )}
    </div>
  );
}
