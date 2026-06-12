import { client } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import { notFound } from "next/navigation";
import { RELEASE_DOWNLOAD } from "@/lib/queries";
import type { Release } from "@/lib/types";
import { verifyDownloadAccess } from "@/lib/verify-download";
import DownloadPanel from "@/components/DownloadPanel";

export const dynamic = "force-dynamic";

export default async function DownloadPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string; token?: string }>;
}) {
  const { slug } = await params;
  const { session_id, token } = await searchParams;

  if (!session_id && !token) notFound();

  // Entitlement is verified HERE, server-side, before any audio URL is fetched.
  // The release (with audio) is only loaded when access is "valid".
  const access = await verifyDownloadAccess({ sessionId: session_id, token, slug });

  // Lightweight metadata for the page header — never includes audio URLs.
  const meta: { title?: string; artist?: string; coverArt?: unknown } | null = client
    ? await client.fetch(
        `*[_type == "release" && slug.current == $slug][0]{
          title,
          "artist": coalesce(artists[0]->name, displayArtist, artist->name),
          coverArt
        }`,
        { slug },
      )
    : null;

  if (!meta) notFound();

  const releaseTitle = meta.title || "your release";
  const releaseArtist = meta.artist || "Daisy Chain";

  // Definitively bad token/session — show a message, expose nothing.
  if (access.status === "invalid") {
    return (
      <Shell coverArt={meta.coverArt} title={releaseTitle}>
        <h1 className="text-headline mb-2">We couldn&apos;t verify this download</h1>
        <p className="text-text-secondary">
          This link may have expired or already been used. If you believe this is an error,
          email <span className="text-text-primary">playerdave@daisychainsd.com</span> and
          we&apos;ll sort it out.
        </p>
      </Shell>
    );
  }

  // Infra hiccup — don't expose audio, but let them retry with a reload.
  if (access.status === "error") {
    return (
      <Shell coverArt={meta.coverArt} title={releaseTitle}>
        <h1 className="text-headline mb-2">Confirming your purchase…</h1>
        <p className="text-text-secondary mb-6">
          We&apos;re having trouble reaching our payment system for a moment. Refresh this
          page and your downloads will appear.
        </p>
      </Shell>
    );
  }

  // Verified — now it's safe to load the release with audio URLs.
  const release: Release | null = client
    ? await client.fetch(RELEASE_DOWNLOAD, { slug })
    : null;

  if (!release) notFound();

  return (
    <Shell coverArt={meta.coverArt} title={releaseTitle}>
      <h1 className="text-headline mb-2">Thank you!</h1>
      <p className="text-text-secondary mb-8">
        Your purchase of <span className="text-text-primary">{releaseTitle}</span> by{" "}
        <span className="text-text-primary">{releaseArtist}</span> is complete.
      </p>

      <DownloadPanel
        tracks={release.tracks || []}
        releaseArtist={release.artist || releaseArtist}
        preVerified
        purchasedTrackKey={access.trackKey}
      />
    </Shell>
  );
}

function Shell({
  coverArt,
  title,
  children,
}: {
  coverArt: unknown;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-20">
      <div className="container-organic p-6 sm:p-8 text-center">
        {coverArt ? (
          <div className="container-inset w-48 h-48 mx-auto mb-8 relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlFor(coverArt).width(300).url()}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
