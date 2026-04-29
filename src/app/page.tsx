import type { PortableTextBlock } from "@portabletext/react";
import { client } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import { HOMEPAGE_SETTINGS, LATEST_RELEASE } from "@/lib/queries";
import UpcomingEventCard from "@/components/UpcomingEventCard";
import WordmarkHero from "@/components/WordmarkHero";
import NewsMarquee from "@/components/NewsMarquee";
import ReleaseSpotlight from "@/components/ReleaseSpotlight";
import ShopStrip from "@/components/ShopStrip";
import SectionHeader from "@/components/SectionHeader";
import Link from "next/link";
import LayloModal from "@/components/LayloModal";
import { ArrowIcon } from "@/components/icons";

export const revalidate = 60;

type SanityImageRef = { asset?: { _ref?: string; _type?: string } } | Record<string, unknown>;

interface UpcomingShow {
  title: string;
  slug: string;
  date: string;
  venue?: string;
  flyer?: SanityImageRef;
  ticketUrl?: string;
  lineup?: { name: string; artistSlug?: string }[];
}

interface UpcomingRelease {
  title: string;
  slug: string;
  artist: string;
  coverArt?: SanityImageRef;
  presaveUrl?: string;
  catalogNumber?: string;
  status?: string;
}

interface UpcomingItem {
  itemType: "show" | "release";
  show?: UpcomingShow;
  release?: UpcomingRelease;
}

interface HomepageSettings {
  upcoming?: UpcomingItem[];
}

interface LatestReleaseData {
  title: string;
  slug: string;
  artist: string;
  artistSlug?: string;
  coverArt?: SanityImageRef;
  catalogNumber?: string;
  releaseType?: string;
  releaseDate?: string;
  price?: number;
  description?: PortableTextBlock[] | string;
  tracks?: { title: string; trackArtist?: string; trackArtists?: { name: string; slug: string }[]; trackNumber?: number; duration?: string }[];
}

export default async function HomePage() {
  const [settings, latest] = await Promise.all([
    client?.fetch<HomepageSettings | null>(HOMEPAGE_SETTINGS) ?? Promise.resolve(null),
    client?.fetch<LatestReleaseData | null>(LATEST_RELEASE) ?? Promise.resolve(null),
  ]);
  // Auto-prune: once a release flips to status:"live" (via the daily cron on
  // release day, or manually in Studio), drop it from the Upcoming section so
  // the homepage doesn't keep advertising a release that's already out.
  // Show items always render — past-show pruning would need a date check and
  // is intentionally left for manual control.
  const upcomingItems = (settings?.upcoming ?? []).filter((item) => {
    if (item.itemType === "release" && item.release?.status !== "upcoming") {
      return false;
    }
    return true;
  });

  return (
    <>
      {/* Negative margin cancels the layout's pt-24 so the wordmark hero photo
          extends up behind the fixed header (no visible gap at the top edge).
          WordmarkHero's inner content has its own top padding to clear the header. */}
      <div className="-mt-24">
        <WordmarkHero />
      </div>

      <NewsMarquee />

      {upcomingItems.length > 0 && (
        <section
          className="max-w-[1440px] mx-auto"
          style={{ padding: "clamp(40px, 5vw, 56px) clamp(24px, 4vw, 48px)" }}
        >
          <SectionHeader
            kicker="Next Up"
            title="Upcoming"
            right={
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href="/events"
                  className="container-pill-r inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-blue-300 border border-blue-300/30 bg-blue-300/5 hover:bg-blue-300/10 hover:border-blue-300/60 transition-colors"
                >
                  All Shows
                  <ArrowIcon />
                </Link>
                <Link
                  href="/music"
                  className="container-pill-r inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-blue-300 border border-blue-300/30 bg-blue-300/5 hover:bg-blue-300/10 hover:border-blue-300/60 transition-colors"
                >
                  All Music
                  <ArrowIcon />
                </Link>
              </div>
            }
          />
          <div className="grid grid-cols-1 min-[1280px]:grid-cols-2 gap-6">
            {upcomingItems.map((item, i) => {
              if (item.itemType === "show" && item.show) {
                const show = item.show;
                return (
                  <div key={`show-${show.slug}-${i}`} className="min-w-0">
                    <UpcomingEventCard
                      title={show.title}
                      date={show.date}
                      venue={show.venue}
                      flyerUrl={show.flyer ? urlFor(show.flyer).width(800).url() : undefined}
                      ticketUrl={show.ticketUrl}
                    />
                  </div>
                );
              }

              if (item.itemType === "release" && item.release) {
                const rel = item.release;
                const coverUrl = rel.coverArt
                  ? urlFor(rel.coverArt).width(700).height(700).fit("crop").crop("center").url()
                  : "";
                const isUpcoming = rel.status === "upcoming";

                return (
                  <div
                    key={`release-${rel.slug}-${i}`}
                    className="min-w-0 container-organic overflow-hidden p-3 sm:p-4"
                  >
                    <div className="grid md:grid-cols-2 gap-8 h-full">
                      <div className="container-inset aspect-square relative overflow-hidden">
                        <Link href={`/releases/${rel.slug}`} className="block w-full h-full">
                          {coverUrl ? (
                            <img
                              src={coverUrl}
                              alt={rel.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-bg-raised" />
                          )}
                        </Link>
                        {isUpcoming && (
                          <span className="absolute top-3 right-3 z-10 rounded-full bg-blue-300/20 border border-blue-300/30 backdrop-blur-sm px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-blue-300 select-none pointer-events-none">
                            Soon
                          </span>
                        )}
                      </div>

                      {/* md+ removes inner padding so content aligns top + bottom with image edges */}
                      <div className="flex flex-col justify-between p-4 sm:p-6 md:p-0">
                        {/* TOP ZONE */}
                        <div className="flex flex-col gap-3">
                          <span
                            className="container-pill-l inline-block w-fit uppercase tracking-wider text-blue-300 border border-blue-300/20 bg-blue-300/5 text-xs px-3 py-1"
                            data-label
                          >
                            New Music
                          </span>
                          {rel.catalogNumber && (
                            <p className="text-text-muted font-mono text-xs">
                              {rel.catalogNumber}
                            </p>
                          )}
                          <h3 className="font-black leading-tight text-text-primary text-2xl md:text-xl">
                            {rel.title}
                          </h3>
                          <p className="text-blue-300 text-lg">{rel.artist}</p>
                        </div>

                        {/* BOTTOM ZONE — Laylo trigger above CTA so both card buttons bottom-align */}
                        <div className="border-t border-blue-300/10 pt-5 mt-5 flex flex-col gap-3">
                          <div className="text-left text-xs text-text-secondary">
                            <LayloModal />
                          </div>
                          {rel.presaveUrl ? (
                            <a
                              href={rel.presaveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="container-pill-r flex w-full items-center justify-center gap-2 px-6 py-3 text-sm font-semibold bg-blue-300 text-bg-deep hover:bg-blue-200 hover:shadow-[0_0_24px_rgba(124,185,232,0.2)] transition-[background-color,box-shadow]"
                            >
                              Pre-save
                              <ArrowIcon />
                            </a>
                          ) : (
                            <Link
                              href={`/releases/${rel.slug}`}
                              className="container-pill-r flex w-full items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-blue-300/60 border border-blue-300/20 bg-blue-300/5"
                              data-label
                            >
                              Soon
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        </section>
      )}

      <ReleaseSpotlight release={latest} />

      <ShopStrip />
    </>
  );
}
