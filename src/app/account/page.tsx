import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Account" };
import { sanityFetch } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import { RELEASES_BY_SLUGS, ALL_RELEASES_DOWNLOAD } from "@/lib/queries";
import AccountClient from "./AccountClient";

interface DownloadRelease {
  title: string;
  slug: string;
  artist: string;
  coverArt?: any;
  catalogNumber?: string;
  tracks?: {
    _key?: string;
    title: string;
    trackArtist?: string;
    trackArtists?: { name: string; slug: string }[];
    trackNumber?: number;
    audioUrl?: string;
  }[];
}

export default async function AccountPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("has_unlimited_pass")
    .eq("id", user.id)
    .single();

  const hasUnlimitedPass = profile?.has_unlimited_pass ?? false;

  let releases: DownloadRelease[] = [];

  if (hasUnlimitedPass) {
    releases = await sanityFetch<DownloadRelease>(ALL_RELEASES_DOWNLOAD);
  } else {
    const { data: purchases } = await supabase
      .from("purchases")
      .select("release_slug, track_key")
      .eq("user_id", user.id);

    // Build a map of release_slug → purchased track_keys (null = full release)
    const purchaseMap = new Map<string, string[] | null>();
    for (const p of purchases ?? []) {
      const existing = purchaseMap.get(p.release_slug);
      if (existing === null) continue; // already have full release
      if (!p.track_key) {
        purchaseMap.set(p.release_slug, null); // full release
      } else if (existing) {
        existing.push(p.track_key);
      } else {
        purchaseMap.set(p.release_slug, [p.track_key]);
      }
    }

    const slugs = [...purchaseMap.keys()];

    if (slugs.length > 0) {
      releases = await sanityFetch<DownloadRelease>(RELEASES_BY_SLUGS, {
        slugs,
      });

      // Filter tracks to only purchased ones for per-track purchases
      releases = releases.map((r) => {
        const trackKeys = purchaseMap.get(r.slug);
        if (trackKeys === null || trackKeys === undefined) return r; // full release
        return {
          ...r,
          tracks: r.tracks?.filter((t) => t._key && trackKeys.includes(t._key)),
        };
      });
    }
  }

  const releasesWithCovers = releases.map((r) => ({
    ...r,
    coverUrl: r.coverArt ? urlFor(r.coverArt).width(400).url() : "",
  }));

  return (
    <AccountClient
      email={user.email ?? ""}
      hasUnlimitedPass={hasUnlimitedPass}
      releases={releasesWithCovers}
    />
  );
}
