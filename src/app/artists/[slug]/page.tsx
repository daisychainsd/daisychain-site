import type { Metadata } from "next";
import { client } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import { notFound } from "next/navigation";
import { ARTIST_DETAIL } from "@/lib/queries";
import type { Artist } from "@/lib/types";
import ReleaseCard from "@/components/ReleaseCard";
import {
  siInstagram,
  siSpotify,
  siApplemusic,
  siBeatport,
  siYoutube,
  siSoundcloud,
} from "simple-icons";
import { IconSocialLink } from "@/components/BrandIcon";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artist: Artist | null = client
    ? await client.fetch(ARTIST_DETAIL, { slug })
    : null;
  if (!artist) return {};
  return { title: artist.name };
}

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

  const artistIconLinkClass =
    "inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-full border border-blue-300/20 text-blue-300 hover:bg-blue-300/10 hover:border-blue-300/50 transition-colors";

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Artist identity — photo + name + links, floating on the page background */}
      <div className="mb-16">
        <div className="flex flex-col items-center text-center gap-6 py-4">
          {artist.photo && (
            <div className="container-inset w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 shrink-0 relative">
              <img
                src={urlFor(artist.photo).width(1000).url()}
                alt={artist.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex flex-col items-center">
            <h1 className="text-headline mb-3">{artist.name}</h1>
            {artist.links && (
              <div className="flex flex-wrap gap-2 items-center justify-center">
                {artist.links.instagram && (
                  <IconSocialLink
                    href={artist.links.instagram}
                    label="Instagram"
                    icon={siInstagram}
                    className={artistIconLinkClass}
                  />
                )}
                {artist.links.spotify && (
                  <IconSocialLink
                    href={artist.links.spotify}
                    label="Spotify"
                    icon={siSpotify}
                    className={artistIconLinkClass}
                  />
                )}
                {artist.links.appleMusic && (
                  <IconSocialLink
                    href={artist.links.appleMusic}
                    label="Apple Music"
                    icon={siApplemusic}
                    className={artistIconLinkClass}
                  />
                )}
                {artist.links.beatport && (
                  <IconSocialLink
                    href={artist.links.beatport}
                    label="Beatport"
                    icon={siBeatport}
                    className={artistIconLinkClass}
                  />
                )}
                {artist.links.youtube && (
                  <IconSocialLink
                    href={artist.links.youtube}
                    label="YouTube"
                    icon={siYoutube}
                    className={artistIconLinkClass}
                  />
                )}
                {artist.links.soundcloud && (
                  <IconSocialLink
                    href={artist.links.soundcloud}
                    label="SoundCloud"
                    icon={siSoundcloud}
                    className={artistIconLinkClass}
                  />
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

      {/* Bio card — at the bottom, sizes to the text */}
      {artist.bio && (
        <div className="container-organic p-6 sm:p-8 mt-16">
          <p className="text-label mb-3">About</p>
          <p className="text-text-secondary whitespace-pre-line max-w-3xl">
            {artist.bio}
          </p>
        </div>
      )}
    </div>
  );
}
