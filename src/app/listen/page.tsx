import type { Metadata } from "next";
import { siSpotify, siSoundcloud, siYoutube } from "simple-icons";
import type { SimpleIcon } from "simple-icons";
import { BrandIcon } from "@/components/BrandIcon";
import { ArrowIcon } from "@/components/icons";
import { client } from "@/sanity/client";
import { LISTEN_PAGE } from "@/lib/queries";

// ISR: re-fetch every 60s so URL edits in Studio propagate without a redeploy.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Listen",
  description:
    "The Daisy Chain Recordings discography — every release in one playlist. Pick your player.",
  openGraph: {
    title: "Listen — Daisy Chain Recordings",
    description:
      "The Daisy Chain Recordings discography — every release in one playlist. Pick your player.",
    images: [{ url: "/listen-hero.jpg", width: 1024, height: 576 }],
  },
};

interface ListenPageSettings {
  spotifyUrl?: string;
  soundcloudUrl?: string;
  youtubeUrl?: string;
}

// Fallbacks if the Studio doc is missing or a field is cleared.
const DEFAULTS: Required<ListenPageSettings> = {
  spotifyUrl: "https://open.spotify.com/playlist/5oV1g6o9YNqi2F973BUElj",
  soundcloudUrl:
    "https://soundcloud.com/daisychainrecordings/sets/dcr-discography",
  youtubeUrl: "https://www.youtube.com/playlist?list=PLRS34jDA-lgk",
};

export default async function ListenPage() {
  const settings =
    (await client?.fetch<ListenPageSettings | null>(LISTEN_PAGE)) ?? null;

  const players: { name: string; href: string; icon: SimpleIcon }[] = [
    {
      name: "Spotify",
      href: settings?.spotifyUrl || DEFAULTS.spotifyUrl,
      icon: siSpotify,
    },
    {
      name: "SoundCloud",
      href: settings?.soundcloudUrl || DEFAULTS.soundcloudUrl,
      icon: siSoundcloud,
    },
    {
      name: "YouTube",
      href: settings?.youtubeUrl || DEFAULTS.youtubeUrl,
      icon: siYoutube,
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      {/* Hero */}
      <div className="container-inset relative">
        <img
          src="/listen-hero.jpg"
          alt="The mirror-ball daisy above the dance floor"
          className="w-full h-auto block"
          style={{ aspectRatio: "16/9", objectFit: "cover" }}
        />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none bg-gradient-to-t from-bg-deep/60 via-transparent to-bg-deep/20"
        />
      </div>

      {/* Heading */}
      <div className="mt-10 text-center">
        <div
          className="text-blue-300 uppercase mb-2.5"
          style={{
            fontFamily: "var(--font-heading), system-ui, sans-serif",
            fontSize: 11,
            letterSpacing: "0.12em",
          }}
        >
          — Daisy Chain Recordings
        </div>
        <h1
          className="uppercase text-text-primary m-0"
          style={{
            fontFamily: "var(--font-heading), system-ui, sans-serif",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 0.92,
            fontSize: "clamp(2rem, 10vw, 4.6rem)",
          }}
        >
          Discography
        </h1>
        <p className="text-text-secondary mt-4 mb-0">
          Every release in one playlist. Pick your player.
        </p>
      </div>

      {/* Player links */}
      <div className="mt-9 flex flex-col gap-4">
        {players.map((player) => (
          <a
            key={player.name}
            href={player.href}
            target="_blank"
            rel="noopener noreferrer"
            className="container-organic-md hover-lift group flex items-center gap-4 px-5 py-3 sm:px-6 sm:py-5 transition-colors hover:border-blue-300/40 hover:bg-blue-300/5"
          >
            <span className="inline-flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 shrink-0 rounded-full border border-white/10 text-text-secondary group-hover:text-blue-300 group-hover:border-blue-300/40 transition-colors">
              <BrandIcon icon={player.icon} size={20} />
            </span>
            <span
              className="uppercase text-text-primary flex-1"
              style={{
                fontFamily: "var(--font-heading), system-ui, sans-serif",
                fontWeight: 900,
                fontSize: 20,
                letterSpacing: "-0.02em",
              }}
            >
              {player.name}
            </span>
            <span className="text-text-muted group-hover:text-blue-300 transition-colors">
              <ArrowIcon />
            </span>
          </a>
        ))}
      </div>

      <p
        className="text-text-muted mt-10 mb-0 text-center"
        style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, letterSpacing: "0.04em" }}
      >
        DCR — San Diego, CA
      </p>
    </div>
  );
}
