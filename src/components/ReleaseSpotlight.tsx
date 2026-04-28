import Link from "next/link";
import { urlFor } from "@/sanity/image";
import { ArrowIcon } from "@/components/icons";
import SectionHeader from "@/components/SectionHeader";
import TrackList from "@/components/TrackList";
import type { Track } from "@/lib/types";

type SanityImageRef = { asset?: { _ref?: string; _type?: string } } | Record<string, unknown>;

interface SpotlightRelease {
  title: string;
  slug: string;
  artist: string;
  artistSlug?: string;
  coverArt?: SanityImageRef;
  catalogNumber?: string;
  releaseType?: string;
  status?: string;
  tracks?: Track[];
}

interface ReleaseSpotlightProps {
  release: SpotlightRelease | null;
}

export default function ReleaseSpotlight({ release }: ReleaseSpotlightProps) {
  if (!release) return null;

  const coverUrl = release.coverArt ? urlFor(release.coverArt).width(900).height(900).url() : "";

  return (
    <section
      className="max-w-[1440px] mx-auto"
      style={{ padding: "clamp(40px, 5vw, 56px) clamp(24px, 4vw, 48px)" }}
    >
      <SectionHeader
        kicker="Now Playing"
        title="Latest Release"
        size="xl"
        seeAllHref="/music"
        seeAllLabel="All Music"
      />

      <div className="container-organic overflow-hidden p-3 sm:p-4">
        <div className="grid md:grid-cols-2 gap-8 h-full">
          {/* Cover */}
          <Link
            href={`/releases/${release.slug}`}
            className="container-inset aspect-square relative overflow-hidden block group"
          >
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={release.title}
                className="w-full h-full object-cover image-hover-card-zoom"
              />
            ) : (
              <div className="w-full h-full bg-bg-raised" />
            )}
            {release.catalogNumber && (
              <span className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/55 backdrop-blur-sm text-white/90 font-mono text-xs">
                {release.catalogNumber}
              </span>
            )}
          </Link>

          {/* Info — md+ removes inner padding so content aligns to image edges */}
          <div className="flex flex-col justify-between p-4 sm:p-6 md:p-0 min-w-0">
            {/* TOP ZONE — pill + title + artist + playable tracks */}
            <div className="flex flex-col gap-3 min-w-0">
              <span
                className="container-pill-l inline-block w-fit uppercase tracking-wider text-blue-300 border border-blue-300/20 bg-blue-300/5 text-xs px-3 py-1"
                data-label
              >
                Latest Release
              </span>
              {release.catalogNumber && (
                <p className="text-text-muted font-mono text-xs">{release.catalogNumber}</p>
              )}
              <h3 className="font-black leading-tight text-text-primary text-3xl md:text-4xl">
                {release.title}
              </h3>
              {release.artistSlug ? (
                <Link
                  href={`/artists/${release.artistSlug}`}
                  className="text-blue-300 text-lg hover:text-blue-200 transition-colors w-fit"
                >
                  {release.artist}
                </Link>
              ) : (
                <span className="text-blue-300 text-lg">{release.artist}</span>
              )}
              {release.tracks && release.tracks.length > 0 && (
                <div className="mt-2 min-w-0">
                  <TrackList
                    tracks={release.tracks}
                    releaseArtist={release.artist}
                    releaseStatus={release.status}
                  />
                </div>
              )}
            </div>

            {/* BOTTOM ZONE — single full-width CTA matching upcoming card pattern */}
            <div className="border-t border-blue-300/10 pt-5 mt-5">
              <Link
                href={`/releases/${release.slug}`}
                className="container-pill-r flex w-full items-center justify-center gap-2 px-6 py-3 text-sm font-semibold bg-blue-300 text-bg-deep hover:bg-blue-200 hover:shadow-[0_0_24px_rgba(124,185,232,0.2)] transition-[background-color,box-shadow]"
              >
                View Release
                <ArrowIcon />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
