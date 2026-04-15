import { client } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import { HOMEPAGE_SETTINGS } from "@/lib/queries";
import NewsletterSignup from "@/components/NewsletterSignup";
import UpcomingEventCard from "@/components/UpcomingEventCard";
import Link from "next/link";
import LayloModal from "@/components/LayloModal";

const ArrowIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 8h10m0 0l-4-4m4 4l-4 4" />
  </svg>
);

interface UpcomingShow {
  title: string;
  slug: string;
  date: string;
  venue?: string;
  flyer?: any;
  ticketUrl?: string;
  lineup?: { name: string; artistSlug?: string }[];
}

interface UpcomingRelease {
  title: string;
  slug: string;
  artist: string;
  coverArt?: any;
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

export default async function HomePage() {
  const settings = await client?.fetch<HomepageSettings | null>(HOMEPAGE_SETTINGS) ?? null;
  const upcomingItems = settings?.upcoming ?? [];

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative -mt-24 h-screen overflow-hidden">
        <picture className="w-full h-full">
          <source media="(max-width: 1279px)" srcSet="/hero-vertical.png" />
          <source media="(min-width: 1280px)" srcSet="/hero-horizontal.png" />
          <img
            src="/hero-horizontal.png"
            alt="Daisy Chain"
            className="w-full h-full object-cover object-center"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-t from-bg-deep/60 via-transparent to-bg-deep/20" />
      </section>

      {/* ── Newsletter ── */}
      <div className="border-t border-white/[0.06]">
        <NewsletterSignup />
      </div>

      {/* ── Upcoming ── */}
      {upcomingItems.length > 0 && (
        <section className="border-t border-white/[0.06] py-10 sm:py-16">
          <div className="px-6 sm:px-10 lg:px-16">
            <h2
              className="font-black leading-none tracking-tight uppercase text-text-primary mb-8"
              style={{ fontSize: "clamp(2.75rem, 10vw, 10rem)" }}
            >
              Upcoming
            </h2>
            <div className="flex flex-col min-[1280px]:flex-row gap-6">
              {upcomingItems.map((item, i) => {
                if (item.itemType === "show" && item.show) {
                  const show = item.show;
                  return (
                    <div key={`show-${show.slug}-${i}`} className="flex-1 min-w-0">
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
                    <div key={`release-${rel.slug}-${i}`} className="flex-1 min-w-0 container-organic overflow-hidden">
                      <div className="grid grid-cols-2">
                        <div className="aspect-[4/5] relative overflow-hidden">
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
                            <div className="absolute inset-0 flex items-center justify-center bg-blue-950/50">
                              {rel.presaveUrl ? (
                                <a
                                  href={rel.presaveUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-full bg-blue-300 text-bg-deep px-5 py-2 text-sm font-semibold hover:bg-blue-200 transition-colors flex items-center gap-2"
                                >
                                  Pre-save
                                  <ArrowIcon />
                                </a>
                              ) : (
                                <span className="rounded-full bg-blue-300/10 border border-blue-300/30 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-blue-300">
                                  Coming Soon
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div
                          className="flex flex-col justify-between"
                          style={{ padding: "clamp(0.75rem, 3vw, 1.75rem)" }}
                        >
                          <div>
                            <div style={{ marginBottom: "clamp(0.5rem, 2vw, 1.25rem)" }}>
                              <span
                                className="container-pill-l inline-block uppercase tracking-wider text-blue-300 border border-blue-300/20 bg-blue-300/5"
                                data-label
                                style={{ fontSize: "clamp(0.55rem, 1.4vw, 0.875rem)", padding: "0.25rem clamp(0.5rem, 1.5vw, 1rem)" }}
                              >
                                New Music
                              </span>
                            </div>
                            {rel.catalogNumber && (
                              <p className="text-text-muted font-mono" style={{ fontSize: "clamp(0.55rem, 1.2vw, 0.75rem)", marginBottom: "0.2em" }}>{rel.catalogNumber}</p>
                            )}
                            <h2
                              className="font-black leading-tight text-text-primary"
                              style={{ fontSize: "clamp(0.75rem, 2.5vw, 2rem)", marginBottom: "0.2em" }}
                            >{rel.title}</h2>
                            <p className="text-blue-300" style={{ fontSize: "clamp(0.65rem, 1.8vw, 1.25rem)" }}>{rel.artist}</p>
                          </div>

                          <div>
                            <div className="flex flex-col gap-2">
                              {rel.presaveUrl ? (
                                <a
                                  href={rel.presaveUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="container-pill-r inline-flex items-center gap-1.5 w-fit font-semibold bg-blue-300 text-bg-deep hover:bg-blue-200 hover:shadow-[0_0_24px_rgba(124,185,232,0.2)] transition-[background-color,box-shadow]"
                                  style={{ fontSize: "clamp(0.6rem, 1.5vw, 1rem)", padding: "clamp(0.35rem, 1vw, 0.75rem) clamp(0.6rem, 2vw, 1.5rem)" }}
                                >
                                  Pre-save
                                  <ArrowIcon />
                                </a>
                              ) : (
                                <Link
                                  href={`/releases/${rel.slug}`}
                                  className="container-pill-r inline-flex items-center gap-1.5 w-fit font-medium text-blue-300/60 border border-blue-300/20 bg-blue-300/5"
                                  data-label
                                  style={{ fontSize: "clamp(0.6rem, 1.5vw, 1rem)", padding: "clamp(0.35rem, 1vw, 0.75rem) clamp(0.6rem, 2vw, 1.5rem)" }}
                                >
                                  Coming Soon
                                </Link>
                              )}
                              <LayloModal />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        </section>
      )}

      {upcomingItems.length === 0 && (
        <section className="border-t border-white/[0.06] py-20">
          <div className="px-6 sm:px-10 lg:px-16 max-w-5xl">
            <p className="text-text-muted text-sm">
              Configure upcoming shows and releases in{" "}
              <a href="/studio" className="text-blue-300 hover:underline">Studio → Homepage</a>.
            </p>
          </div>
        </section>
      )}
    </>
  );
}
