import type { Metadata } from "next";
import { sanityFetch } from "@/sanity/client";

export const revalidate = 60;

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
    status: release.status,
    releaseDate: release.releaseDate,
  }));

  return (
    <section
      className="relative overflow-hidden"
      style={{ padding: "clamp(40px, 5vw, 56px) clamp(24px, 4vw, 48px)" }}
    >
      <div className="blob w-[400px] h-[400px] bg-blue-300 bottom-[-50px] left-[-100px] animate-drift" />
      <div className="max-w-7xl mx-auto relative">
        <CatalogGrid releases={catalogReleases} />
      </div>
    </section>
  );
}
