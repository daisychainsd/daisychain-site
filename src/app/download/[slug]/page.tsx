import { client } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import { notFound } from "next/navigation";
import { RELEASE_DOWNLOAD } from "@/lib/queries";
import type { Release } from "@/lib/types";
import DownloadPanel from "@/components/DownloadPanel";

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

  const release: Release | null = client
    ? await client.fetch(RELEASE_DOWNLOAD, { slug })
    : null;

  if (!release) notFound();

  return (
    <div className="max-w-2xl mx-auto px-6 py-20">
      <div className="container-organic p-6 sm:p-8 text-center">
        {release.coverArt && (
          <div className="container-inset w-48 h-48 mx-auto mb-8 relative">
            <img
              src={urlFor(release.coverArt).width(300).url()}
              alt={release.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <h1 className="text-headline mb-2">Thank you!</h1>
        <p className="text-text-secondary mb-8">
          Your purchase of <span className="text-text-primary">{release.title}</span> by{" "}
          <span className="text-text-primary">{release.artist}</span> is complete.
        </p>

        <DownloadPanel
          sessionId={session_id}
          token={token}
          slug={slug}
          tracks={release.tracks || []}
          releaseArtist={release.artist}
        />
      </div>
    </div>
  );
}
