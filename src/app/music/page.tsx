import type { Metadata } from "next";
import { sanityFetch } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import { RELEASES_LIST } from "@/lib/queries";
import type { ReleaseCard as ReleaseCardType } from "@/lib/types";
import CatalogGrid from "@/components/CatalogGrid";

export const metadata: Metadata = {
  title: "Music — Daisy Chain Records",
  description:
    "Browse Daisy Chain digital and physical releases — electronic music from San Diego.",
};

export default async function MusicPage() {
  const releases = await sanityFetch<ReleaseCardType>(RELEASES_LIST);

  const catalogReleases = releases.map((release) => ({
    title: release.title,
    slug: release.slug,
    artist: release.artist,
    coverUrl: release.coverArt ? urlFor(release.coverArt).width(600).url() : "",
    catalogNumber: release.catalogNumber,
    format: release.format,
  }));

  return (
    <section className="relative py-16 sm:py-20 overflow-hidden">
      <div className="blob w-[400px] h-[400px] bg-blue-300 bottom-[-50px] left-[-100px] animate-drift" />
      <div className="max-w-7xl mx-auto px-6 relative">
        <CatalogGrid releases={catalogReleases} />
      </div>
    </section>
  );
}
