"use client";

import { useMemo, useState } from "react";
import ReleaseCard from "./ReleaseCard";

interface CatalogRelease {
  title: string;
  slug: string;
  artist: string;
  coverUrl: string;
  format?: string[];
  catalogNumber?: string;
  status?: string;
  releaseDate?: string;
}

type FilterKey = "all" | "digital" | "vinyl" | "upcoming";
type SortKey = "newest" | "catalog";

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "All",
  digital: "Digital",
  vinyl: "Physical",
  upcoming: "Upcoming",
};

export default function CatalogGrid({ releases }: { releases: CatalogRelease[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const filtered = useMemo(() => {
    let list = releases.slice();

    if (filter === "digital") {
      list = list.filter((r) => r.format?.some((f) => f.toLowerCase().includes("digital")));
    } else if (filter === "vinyl") {
      list = list.filter((r) =>
        r.format?.some((f) => {
          const lower = f.toLowerCase();
          return lower.includes("vinyl") || lower.includes("cd") || lower.includes("cassette");
        }),
      );
    } else if (filter === "upcoming") {
      list = list.filter((r) => r.status === "upcoming");
    }

    if (sort === "newest") {
      list.sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));
    } else if (sort === "catalog") {
      list.sort((a, b) => (a.catalogNumber || "").localeCompare(b.catalogNumber || ""));
    }

    return list;
  }, [releases, filter, sort]);

  return (
    <div>
      {/* Section header + count */}
      <div className="flex justify-between items-end gap-6 mb-8 flex-wrap">
        <div className="min-w-0">
          <div
            className="text-blue-300 uppercase mb-2.5"
            style={{
              fontFamily: "var(--font-heading), system-ui, sans-serif",
              fontSize: 11,
              letterSpacing: "0.12em",
            }}
          >
            — Catalog
          </div>
          <h1
            className="uppercase text-text-primary m-0"
            style={{
              fontFamily: "var(--font-heading), system-ui, sans-serif",
              fontWeight: 900,
              fontSize: "clamp(3rem, 8vw, 7rem)",
              letterSpacing: "-0.03em",
              lineHeight: 0.92,
            }}
          >
            Music
          </h1>
        </div>
        <span
          className="text-text-muted"
          style={{ fontFamily: "var(--font-mono), monospace", fontSize: 13 }}
        >
          {filtered.length} {filtered.length === 1 ? "release" : "releases"}
        </span>
      </div>

      {/* Filter pills + sort row */}
      <div
        className="flex justify-between items-center flex-wrap gap-4 mb-7 pb-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(FILTER_LABELS) as FilterKey[]).map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="uppercase transition-colors"
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  fontFamily: "var(--font-heading), system-ui, sans-serif",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  fontWeight: 700,
                  border: active
                    ? "1px solid var(--color-blue-300)"
                    : "1px solid rgba(255,255,255,0.08)",
                  background: active ? "var(--color-blue-300)" : "transparent",
                  color: active ? "var(--color-bg-deep)" : "var(--color-text-secondary)",
                  cursor: "pointer",
                }}
              >
                {FILTER_LABELS[f]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className="uppercase mr-1.5"
            style={{
              fontFamily: "var(--font-heading), system-ui, sans-serif",
              fontSize: 10,
              letterSpacing: "0.1em",
              color: "var(--color-text-muted)",
            }}
          >
            Sort
          </span>
          {(["newest", "catalog"] as SortKey[]).map((s) => {
            const active = sort === s;
            return (
              <button
                key={s}
                onClick={() => setSort(s)}
                className="transition-colors"
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 11,
                  border: active ? "1px solid rgba(124,185,232,0.3)" : "1px solid rgba(255,255,255,0.08)",
                  background: active ? "rgba(124,185,232,0.05)" : "transparent",
                  color: active ? "var(--color-blue-300)" : "var(--color-text-secondary)",
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
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
          <p className="text-lg">nothing here — try a different filter.</p>
        </div>
      )}
    </div>
  );
}
