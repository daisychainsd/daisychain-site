import { client } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import { notFound } from "next/navigation";
import { ARTIST_DETAIL } from "@/lib/queries";
import type { Artist } from "@/lib/types";
import ReleaseCard from "@/components/ReleaseCard";

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artist: Artist | null = client
    ? await client.fetch(ARTIST_DETAIL, { slug })
    : null;

  if (!artist) notFound();

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Artist bio card */}
      <div className="container-organic p-3 sm:p-4 mb-16">
        <div className="flex flex-col sm:flex-row gap-6">
          {artist.photo && (
            <div className="container-inset w-40 h-40 shrink-0 relative">
              <img
                src={urlFor(artist.photo).width(400).url()}
                alt={artist.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex flex-col justify-center py-2">
            <h1 className="text-headline mb-3">{artist.name}</h1>
            {artist.bio && (
              <p className="text-text-secondary max-w-lg mb-4">{artist.bio}</p>
            )}
            {artist.links && (
              <div className="flex gap-2 text-sm">
                {artist.links.instagram && (
                  <a
                    href={artist.links.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="container-pill-l px-4 py-1.5 text-blue-300 border border-blue-300/20 hover:bg-blue-300/5 transition-colors"
                  >
                    Instagram
                  </a>
                )}
                {artist.links.bandcamp && (
                  <a
                    href={artist.links.bandcamp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="container-pill-l px-4 py-1.5 text-blue-300 border border-blue-300/20 hover:bg-blue-300/5 transition-colors"
                  >
                    Bandcamp
                  </a>
                )}
                {artist.links.soundcloud && (
                  <a
                    href={artist.links.soundcloud}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="container-pill-l px-4 py-1.5 text-blue-300 border border-blue-300/20 hover:bg-blue-300/5 transition-colors"
                  >
                    SoundCloud
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Divider before discography */}
      <div className="divider-glow mb-12" />

      {/* Artist's Releases */}
      <div className="mb-8">
        <p className="text-label mb-2">Discography</p>
        <h2 className="text-title text-text-primary">Releases</h2>
      </div>
      {artist.releases && artist.releases.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8">
          {artist.releases.map((release) => (
            <ReleaseCard
              key={release.slug}
              title={release.title}
              slug={release.slug}
              artist={artist.name}
              coverUrl={release.coverArt ? urlFor(release.coverArt).width(600).url() : ""}
            />
          ))}
        </div>
      ) : (
        <p className="text-text-muted">No releases yet.</p>
      )}
    </div>
  );
}
