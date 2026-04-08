import { client, sanityFetch } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import { RELEASES_LIST, NEXT_EVENT } from "@/lib/queries";
import type { ReleaseCard as ReleaseCardType } from "@/lib/types";
import CatalogGrid from "@/components/CatalogGrid";
import NewsletterSignup from "@/components/NewsletterSignup";
import UpcomingEventCard from "@/components/UpcomingEventCard";
import Link from "next/link";

interface NextEvent {
  title: string;
  slug: string;
  date: string;
  venue?: string;
  flyer?: any;
  ticketUrl?: string;
  lineup?: { name: string; artistSlug?: string }[];
}

const SECTION_HEADING = `font-black leading-none tracking-tight uppercase text-text-primary`;

export default async function HomePage() {
  const [releases, nextEvent] = await Promise.all([
    sanityFetch<ReleaseCardType>(RELEASES_LIST),
    client?.fetch<NextEvent | null>(NEXT_EVENT) ?? null,
  ]);

  const catalogReleases = releases.map((r) => ({
    title: r.title,
    slug: r.slug,
    artist: r.artist,
    coverUrl: r.coverArt ? urlFor(r.coverArt).width(600).url() : "",
    catalogNumber: r.catalogNumber,
    format: r.format,
  }));

  const featuredReleases = releases.slice(0, 3).map((r) => ({
    title: r.title.replace(/\s+(EP|Album)$/i, ""),
    slug: r.slug,
    artist: r.artist,
    catalogNumber: r.catalogNumber,
    coverUrl: r.coverArt
      ? (urlFor(r.coverArt) as any).width(700).height(700).fit("crop").crop("center").url()
      : "",
  }));

  const flyerUrl = nextEvent?.flyer
    ? (urlFor(nextEvent.flyer) as any).width(800).url()
    : undefined;

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative -mt-24 w-full overflow-hidden">
        <img
          src="/hero.png"
          alt="Daisy Chain"
          className="w-full h-auto block"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-deep/60 via-transparent to-bg-deep/20" />
      </section>

      {/* ── SHOWS ── */}
      {nextEvent && (
        <section className="border-t border-white/[0.06] py-10 sm:py-12">
          <div className="max-w-5xl mx-auto px-6">
            <h2
              className={`${SECTION_HEADING} mb-8`}
              style={{ fontSize: "clamp(2.75rem, 10vw, 10rem)" }}
            >
              Shows
            </h2>
            <UpcomingEventCard
              title={nextEvent.title}
              date={nextEvent.date}
              venue={nextEvent.venue}
              flyerUrl={flyerUrl}
              ticketUrl={nextEvent.ticketUrl}
              lineup={nextEvent.lineup}
            />
          </div>
        </section>
      )}

      {/* ── MUSIC ── */}
      {featuredReleases.length > 0 && (
        <section className="border-t border-white/[0.06] py-10 sm:py-12">
          <div className="max-w-7xl mx-auto px-6">
            <h2
              className={`${SECTION_HEADING} mb-8`}
              style={{ fontSize: "clamp(2.75rem, 10vw, 10rem)" }}
            >
              Music
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
              {featuredReleases.map((release, i) => (
                <Link
                  key={release.slug}
                  href={`/releases/${release.slug}`}
                  className={`group block min-w-0${i === 2 ? " hidden sm:block" : ""}`}
                >
                  <div className="container-inset-md aspect-square overflow-hidden mb-3">
                    {release.coverUrl ? (
                      <img
                        src={release.coverUrl}
                        alt={release.title}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-bg-raised" />
                    )}
                  </div>
                  {release.catalogNumber && (
                    <p className="text-text-muted text-xs font-mono mb-0.5">{release.catalogNumber}</p>
                  )}
                  <p className="text-text-primary text-sm font-semibold truncate">{release.title}</p>
                  <p className="text-text-secondary text-xs truncate">{release.artist}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Newsletter ── */}
      <div className="border-t border-white/[0.06]">
        <NewsletterSignup />
      </div>

      {/* ── Catalog ── */}
      <section className="relative py-16 sm:py-20 overflow-hidden border-t border-white/[0.06]">
        <div className="blob w-[400px] h-[400px] bg-blue-300 bottom-[-50px] left-[-100px] animate-drift" />
        <div className="max-w-7xl mx-auto px-6 relative">
          <CatalogGrid releases={catalogReleases} />
        </div>
      </section>
    </>
  );
}
