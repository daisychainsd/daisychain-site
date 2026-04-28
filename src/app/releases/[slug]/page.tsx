import { client } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import { notFound } from "next/navigation";
import { RELEASE_DETAIL } from "@/lib/queries";
import type { Release } from "@/lib/types";
import ReleaseInteractive from "@/components/ReleaseInteractive";

export const revalidate = 60;

export default async function ReleasePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const release: Release | null = client
    ? await client.fetch(RELEASE_DETAIL, { slug })
    : null;

  if (!release) notFound();

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <ReleaseInteractive
        formats={release.format}
        price={release.price}
        physicalPrice={release.physicalPrice}
        tracks={release.tracks || []}
        releaseArtist={release.artist}
        releaseTitle={release.title}
        releaseId={release._id}
        releaseSlug={release.slug}
        artistSlug={release.artistSlug}
        primaryArtistName={release.primaryArtistName}
        artists={release.artists}
        additionalArtists={release.additionalArtists}
        remixerSlug={release.remixerSlug}
        catalogNumber={release.catalogNumber}
        releaseType={release.releaseType}
        releaseDate={release.releaseDate}
        coverUrl={release.coverArt ? urlFor(release.coverArt).width(800).url() : undefined}
        shopifyHandle={release.shopifyHandle}
        status={release.status}
        presaveUrl={release.presaveUrl}
        embedUrl={release.embedUrl}
        links={release.links}
      />
    </div>
  );
}
