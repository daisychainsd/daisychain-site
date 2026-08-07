import { sanityFetch } from "@/sanity/client";

/**
 * Weekly catalog audit — crawls every live release and verifies:
 *   - the release page on daisychainsd.com responds
 *   - every DSP link (Spotify/Apple/YouTube/SoundCloud/Bandcamp) still resolves
 *   - every track's master WAV + preview MP3 asset responds on the Sanity CDN
 *   - data completeness: cover art on releases, photos on roster artists
 *
 * Master audioUrl values are fetched here (server-only module) for HEAD checks
 * but must never be included in reports — track titles only.
 *
 * Limitations: platforms that return 200 for removed content (YouTube shows
 * "Video unavailable" with a 200) can't be caught by status code; 403/429
 * responses (bot-blocking) are reported as "unverifiable", not broken, to
 * avoid false alarms.
 */

const SITE = "https://www.daisychainsd.com";

type AuditRelease = {
  title: string;
  slug: string;
  catalogNumber?: string;
  hasCover: boolean;
  hasDescription: boolean;
  links?: Record<string, string | undefined>;
  tracks?: { title?: string; audioUrl?: string; previewUrl?: string }[];
};

type AuditArtist = { name: string; hasPhoto: boolean; hasBio: boolean; hasLinks: boolean };

type AuditEvent = { title: string };

export type AuditFinding = {
  kind: "broken" | "unverifiable" | "missing";
  where: string; // e.g. "DCR#22 Ballerina"
  what: string; // e.g. "Spotify link (HTTP 404)"
};

export type AuditCounts = {
  releases: number;
  pages: number;
  dspLinks: number;
  files: number;
  artists: number;
};

// status != "upcoming" (not == "live") — docs older than the status field have it undefined
const RELEASES_QUERY = `*[_type == "release" && hidden != true && status != "upcoming"] | order(releaseDate desc) {
  title,
  "slug": slug.current,
  catalogNumber,
  "hasCover": defined(coverArt),
  "hasDescription": defined(description),
  links,
  tracks[]{ title, "audioUrl": audioFile.asset->url, "previewUrl": previewFile.asset->url }
}`;

const ARTISTS_QUERY = `*[_type == "artist" && rosterTier != "side"] {
  name,
  "hasPhoto": defined(photo),
  "hasBio": defined(bio),
  "hasLinks": defined(coalesce(links.website, links.instagram, links.spotify, links.soundcloud))
}`;

const EVENTS_NO_FLYER_QUERY = `*[_type == "event" && hidden != true && !defined(flyer)] { title }`;

type UrlResult = { ok: boolean; status: number | null };

async function checkUrl(url: string, method: "GET" | "HEAD"): Promise<UrlResult> {
  // One retry on timeout/network error — a transient flake in a weekly report
  // reads as a real failure and erodes trust in the audit.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        headers: {
          // Some DSPs 403 obvious bots; a browser UA keeps the check honest.
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(15000),
      });
      return { ok: res.ok, status: res.status };
    } catch {
      // fall through to retry
    }
  }
  return { ok: false, status: null };
}

/** Run tasks with bounded concurrency — a few hundred external requests total. */
async function inBatches<T>(tasks: (() => Promise<T>)[], size = 8): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < tasks.length; i += size) {
    out.push(...(await Promise.all(tasks.slice(i, i + size).map((t) => t()))));
  }
  return out;
}

const DSP_LABELS: Record<string, string> = {
  spotify: "Spotify",
  appleMusic: "Apple Music",
  youtube: "YouTube",
  soundcloud: "SoundCloud",
  bandcamp: "Bandcamp",
};

function describe(r: UrlResult): string {
  return r.status === null ? "no response" : `HTTP ${r.status}`;
}

export type AuditResult = {
  checkedAt: string;
  counts: AuditCounts;
  findings: AuditFinding[];
};

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "02wrtovm";
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";

/**
 * Persist the latest audit result as a singleton Sanity doc so the /ops
 * dashboard can show it without re-running the ~40s crawl on page load.
 * Best-effort — the emailed report is the primary output.
 */
export async function saveAuditResult(findings: AuditFinding[], counts: AuditCounts): Promise<void> {
  const token = process.env.SANITY_API_TOKEN;
  if (!token) {
    console.warn("SANITY_API_TOKEN not set — skipping audit result save");
    return;
  }
  const res = await fetch(`https://${PROJECT_ID}.api.sanity.io/v2024-01-01/data/mutate/${DATASET}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      mutations: [
        {
          createOrReplace: {
            _id: "catalogAuditResult",
            _type: "catalogAuditResult",
            checkedAt: new Date().toISOString(),
            counts,
            findings: findings.map((f, i) => ({ _key: String(i), ...f })),
          },
        },
      ],
    }),
  });
  if (!res.ok) {
    console.error(`Failed to save audit result: ${res.status} ${await res.text()}`);
  }
}

/** Latest stored audit result, or null if the cron has never run. */
export async function getLatestAuditResult(): Promise<AuditResult | null> {
  const rows = await sanityFetch<AuditResult>(
    `*[_id == "catalogAuditResult"][0...1]{ checkedAt, counts, findings[]{ kind, where, what } }`
  );
  return rows[0] ?? null;
}

export async function runCatalogAudit(): Promise<{
  findings: AuditFinding[];
  counts: AuditCounts;
}> {
  const [releases, artists, eventsNoFlyer] = await Promise.all([
    sanityFetch<AuditRelease>(RELEASES_QUERY),
    sanityFetch<AuditArtist>(ARTISTS_QUERY),
    sanityFetch<AuditEvent>(EVENTS_NO_FLYER_QUERY),
  ]);

  const findings: AuditFinding[] = [];
  const tasks: (() => Promise<void>)[] = [];
  let dspLinks = 0;
  let files = 0;

  const push = (kind: AuditFinding["kind"], where: string, what: string) =>
    findings.push({ kind, where, what });

  for (const rel of releases) {
    const where = [rel.catalogNumber, rel.title].filter(Boolean).join(" ") || rel.slug;

    // Release page on the site
    tasks.push(async () => {
      const r = await checkUrl(`${SITE}/releases/${rel.slug}`, "GET");
      if (!r.ok) push("broken", where, `release page /releases/${rel.slug} (${describe(r)})`);
    });

    // DSP links
    for (const [key, url] of Object.entries(rel.links || {})) {
      if (!url || typeof url !== "string" || !url.startsWith("http")) continue;
      dspLinks++;
      const label = DSP_LABELS[key] || key;
      tasks.push(async () => {
        const r = await checkUrl(url, "GET");
        if (r.ok) return;
        if (r.status === 403 || r.status === 429) {
          push(
            "unverifiable",
            where,
            `${label} link (${describe(r)} — likely bot-blocking, check by hand if it repeats)`
          );
        } else {
          push("broken", where, `${label} link (${describe(r)}) — ${url}`);
        }
      });
    }

    // Track files on the Sanity CDN
    for (const track of rel.tracks || []) {
      const t = track.title || "untitled track";
      if (!track.audioUrl) {
        push("missing", where, `"${t}" has no master WAV (not purchasable)`);
      } else {
        files++;
        const url = track.audioUrl;
        tasks.push(async () => {
          const r = await checkUrl(url, "HEAD");
          if (!r.ok) push("broken", where, `"${t}" master WAV unreachable (${describe(r)})`);
        });
      }
      if (!track.previewUrl) {
        push("missing", where, `"${t}" has no preview MP3 (not streamable on site)`);
      } else {
        files++;
        const url = track.previewUrl;
        tasks.push(async () => {
          const r = await checkUrl(url, "HEAD");
          if (!r.ok) push("broken", where, `"${t}" preview MP3 unreachable (${describe(r)})`);
        });
      }
    }

    if (!rel.hasCover) push("missing", where, "no cover art");
    if (!rel.hasDescription) push("missing", where, "no description");
    const linkCount = Object.values(rel.links || {}).filter(
      (v) => typeof v === "string" && v.startsWith("http")
    ).length;
    if (linkCount === 0) push("missing", where, "no streaming links at all");
  }

  for (const artist of artists) {
    if (!artist.hasPhoto) push("missing", artist.name, "no artist photo");
    if (!artist.hasBio) push("missing", artist.name, "no bio");
    if (!artist.hasLinks) push("missing", artist.name, "no links (website/IG/Spotify/SoundCloud)");
  }

  for (const ev of eventsNoFlyer) {
    push("missing", ev.title, "no event flyer");
  }

  await inBatches(tasks);

  return {
    findings,
    counts: {
      releases: releases.length,
      pages: releases.length,
      dspLinks,
      files,
      artists: artists.length,
    },
  };
}
