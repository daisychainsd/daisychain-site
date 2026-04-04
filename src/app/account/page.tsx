import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    title: string;
    trackArtist?: string;
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
      .select("release_slug")
      .eq("user_id", user.id);

    const slugs = purchases?.map((p: { release_slug: string }) => p.release_slug) ?? [];

    if (slugs.length > 0) {
      releases = await sanityFetch<DownloadRelease>(RELEASES_BY_SLUGS, {
        slugs,
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
