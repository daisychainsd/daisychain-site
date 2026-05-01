import { sanityFetch } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import { ARTISTS_LIST } from "@/lib/queries";
import type { Artist } from "@/lib/types";
import Link from "next/link";
import SectionHeader from "@/components/SectionHeader";

// ISR: re-fetch the roster (and the rosterTier filter) every 60s so Studio
// edits propagate to the deployed site without a manual redeploy.
export const revalidate = 60;

export default async function ArtistsPage() {
  const artists = await sanityFetch<Artist>(ARTISTS_LIST);

  return (
    <div className="max-w-[1440px] mx-auto" style={{ padding: "clamp(40px, 5vw, 56px) clamp(24px, 4vw, 48px)" }}>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-9">
        <SectionHeader kicker="Roster" title="Artists" size="xl" as="h1" />
        <span
          className="text-text-muted"
          style={{ fontFamily: "var(--font-mono), monospace", fontSize: 13 }}
        >
          {artists.length} {artists.length === 1 ? "name" : "names"}
        </span>
      </div>

      {artists.length > 0 ? (
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
        >
          {artists.map((artist) => (
            <ArtistCard key={artist.slug} artist={artist} />
          ))}
        </div>
      ) : (
        <p className="text-text-muted text-center py-20">
          No artists yet — add them at{" "}
          <a href="/studio" className="text-blue-300 hover:underline">
            /studio
          </a>
        </p>
      )}
    </div>
  );
}

function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <Link href={`/artists/${artist.slug}`} className="group block hover-lift">
      <div
        style={{
          borderRadius: "var(--radius-organic-md)",
          background: "var(--color-bg-surface)",
          border: "1px solid rgba(255,255,255,0.06)",
          padding: 8,
        }}
      >
        {/* Portrait */}
        <div
          className="relative overflow-hidden"
          style={{
            aspectRatio: "4/5",
            borderRadius: "var(--radius-organic-inv-md)",
            border: "1px solid rgba(255,255,255,0.04)",
            background: "var(--color-bg-raised)",
          }}
        >
          {artist.photo ? (
            <img
              src={urlFor(artist.photo).width(500).url()}
              alt={artist.name}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover grayscale image-hover-artist-photo"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-text-faint text-4xl font-black">
              {artist.name.charAt(0)}
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="px-2.5 pt-3.5 pb-2.5">
          <h3
            className="uppercase text-text-primary m-0"
            style={{
              fontFamily: "var(--font-heading), system-ui, sans-serif",
              fontWeight: 900,
              fontSize: 22,
              letterSpacing: "-0.02em",
            }}
          >
            {artist.name}
          </h3>
          {artist.hometown && (
            <p
              className="text-text-secondary m-0 mt-1.5"
              style={{ fontFamily: "var(--font-mono), monospace", fontSize: 13, letterSpacing: "0.02em" }}
            >
              {artist.hometown}
            </p>
          )}
          {artist.role && (
            <p className="text-text-muted text-[13px] m-0 mt-1.5">{artist.role}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
