import { sanityFetch } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import { RELEASES_LIST } from "@/lib/queries";
import type { ReleaseCard as ReleaseCardType } from "@/lib/types";
import ReleaseCard from "@/components/ReleaseCard";

export default async function HomePage() {
  const releases = await sanityFetch<ReleaseCardType>(RELEASES_LIST);

  return (
    <>
      {/* Hero — zone-abyss */}
      <section className="zone-abyss relative overflow-hidden py-24 sm:py-32">
        {/* Decorative blob */}
        <div className="blob w-[600px] h-[600px] bg-blue-400 top-[-100px] right-[-100px] animate-drift" />

        {/* Watermark flower — offset to right */}
        <div className="absolute top-1/2 right-[10%] -translate-y-1/2 pointer-events-none">
          <img
            src="/flower-blue.png"
            alt=""
            className="w-[500px] h-[500px] object-contain opacity-[0.04] animate-slow-spin"
          />
        </div>

        {/* Radial glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at 30% 50%, rgba(124,185,232,0.06) 0%, transparent 60%)",
        }} />

        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="container-organic p-8 sm:p-12 max-w-2xl">
            <h1 className="text-display text-text-primary">
              DAISY<br />CHAIN
            </h1>
            <div className="w-24 h-1 bg-gradient-to-r from-blue-300 to-blue-500 mt-6 mb-5 rounded-full" />
            <p className="text-text-secondary text-lg max-w-md">
              Independent electronic music — San Diego, CA
            </p>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="divider-glow" />

      {/* Catalog — zone-deep */}
      <section className="zone-deep relative py-16 sm:py-20">
        {/* Decorative blob */}
        <div className="blob w-[400px] h-[400px] bg-blue-300 bottom-[-50px] left-[-100px] animate-drift" />

        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="mb-10">
            <p className="text-label mb-2">Catalog</p>
            <h2 className="text-headline text-text-primary">Releases</h2>
          </div>
          {releases.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8">
              {releases.map((release) => (
                <ReleaseCard
                  key={release.slug}
                  title={release.title}
                  slug={release.slug}
                  artist={release.artist}
                  coverUrl={release.coverArt ? urlFor(release.coverArt).width(600).url() : ""}
                  catalogNumber={release.catalogNumber}
                  format={release.format}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-text-muted">
              <p className="text-2xl mb-2">No releases yet</p>
              <p className="text-sm">
                Connect Sanity and add your first release at{" "}
                <a href="/studio" className="text-blue-300 hover:underline">
                  /studio
                </a>
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
