import { client } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import { notFound } from "next/navigation";
import { RELEASE_DETAIL } from "@/lib/queries";
import type { Release } from "@/lib/types";
import ReleaseInteractive from "@/components/ReleaseInteractive";

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
      {/* Cover + Metadata in one organic container */}
      <div className="container-organic p-3 sm:p-4">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Cover Art — inset container */}
          <div className="container-inset aspect-square relative">
            {release.coverArt ? (
              <img
                src={urlFor(release.coverArt).width(800).url()}
                alt={release.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-muted text-2xl bg-bg-raised">
                {release.catalogNumber}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col justify-center p-2 sm:p-4">
            <p className="text-meta mb-3">
              {release.catalogNumber}
              {release.releaseType && (
                <span className="ml-2 text-blue-300/70">
                  {release.releaseType}
                </span>
              )}
            </p>
            <h1 className="text-headline mb-2">{release.title}</h1>
            <a
              href={`/artists/${release.artistSlug}`}
              className="text-blue-300 hover:underline text-lg mb-6"
            >
              {release.artist}
            </a>

            {release.releaseDate && (
              <p className="text-text-secondary text-sm">
                Released{" "}
                {new Date(release.releaseDate).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Track List + Format Toggle */}
      {release.tracks && release.tracks.length > 0 && (
        <section className="mt-12">
          <div className="mb-4">
            <p className="text-label mb-1">Tracks</p>
            <h2 className="text-title text-text-primary">Tracklist</h2>
          </div>
          <ReleaseInteractive
            formats={release.format}
            price={release.price}
            physicalPrice={release.physicalPrice}
            tracks={release.tracks}
            releaseArtist={release.artist}
            releaseTitle={release.title}
            releaseId={release._id}
            releaseSlug={release.slug}
          />
        </section>
      )}

      {/* Embedded Player fallback */}
      {release.embedUrl && (
        <section className="mt-12">
          <iframe
            src={release.embedUrl}
            className="w-full h-[120px] rounded-sm"
            allow="autoplay"
            title={`Listen to ${release.title}`}
          />
        </section>
      )}
    </div>
  );
}
