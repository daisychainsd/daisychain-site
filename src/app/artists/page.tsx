import { sanityFetch } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import { ARTISTS_LIST } from "@/lib/queries";
import type { Artist } from "@/lib/types";
import Link from "next/link";

export default async function ArtistsPage() {
  const artists = await sanityFetch<Artist>(ARTISTS_LIST);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-10">
        <p className="text-label mb-2">Roster</p>
        <h1 className="text-headline text-text-primary">Artists</h1>
      </div>
      {artists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8">
          {artists.map((artist) => (
            <Link
              key={artist.slug}
              href={`/artists/${artist.slug}`}
              className="group block"
            >
              <div className="container-organic-md p-2 hover-lift">
                <div className="container-inset-md aspect-square relative overflow-hidden">
                  {artist.photo ? (
                    <img
                      src={urlFor(artist.photo).width(400).url()}
                      alt={artist.name}
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-bg-raised" />
                  )}
                </div>
                <div className="px-2 pt-3 pb-2">
                  <p className="font-medium truncate">{artist.name}</p>
                  <p className="text-text-secondary text-sm">
                    {artist.releaseCount} release
                    {artist.releaseCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-text-muted text-center py-20">
          No artists yet — add them at{" "}
          <a href="/studio" className="text-blue-300 hover:underline">
            /studio
          </a>
        </p>
      )}
    </div>
  );
}
