import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/**
 * Daily cron handler. Finds any release whose `releaseDate` has arrived and
 * still has `status: "upcoming"`, flips it to `status: "live"`, and revalidates
 * the public surfaces so the new "Latest Release" appears within seconds.
 *
 * Streaming links (Spotify, Apple Music, YouTube, SoundCloud, Bandcamp) are
 * populated manually in Sanity Studio under the release's
 * "Streaming / DSP Links" collapsible — the auto-populate experiments only
 * found Apple Music reliably and that wasn't worth the script-maintenance cost.
 *
 * Schedule (vercel.json): `0 4 * * *` UTC.
 *   - In EDT (UTC-4, summer) this fires at 00:00 ET — exactly midnight.
 *   - In EST (UTC-5, winter) this fires at 23:00 ET the night before.
 *   Vercel Cron is UTC-only; adjust between `0 4` (summer) and `0 5` (winter) at DST boundaries.
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}` header. Vercel Cron
 * sends this automatically when CRON_SECRET is set in Vercel env vars.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "02wrtovm";
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const SANITY_API = `https://${PROJECT_ID}.api.sanity.io/v2024-01-01`;

type ReleaseRow = {
  _id: string;
  title: string;
  slug: string;
  catalogNumber?: string;
  releaseDate?: string;
};

async function fetchUpcomingDue(): Promise<ReleaseRow[]> {
  const token = process.env.SANITY_API_TOKEN;
  if (!token) throw new Error("SANITY_API_TOKEN not set");

  // Releases still flagged upcoming whose releaseDate has arrived (UTC-evaluated).
  const query = `*[_type == "release" && hidden != true && status == "upcoming" && defined(releaseDate) && dateTime(releaseDate + "T00:00:00Z") <= dateTime(now())] {
    _id,
    title,
    "slug": slug.current,
    catalogNumber,
    releaseDate
  }`;
  const url = `${SANITY_API}/data/query/${DATASET}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Sanity query failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { result?: ReleaseRow[] };
  return (json.result || []).filter((r) => r.title && r.slug);
}

async function patchStatus(_id: string): Promise<void> {
  const token = process.env.SANITY_API_TOKEN;
  if (!token) throw new Error("SANITY_API_TOKEN not set");
  const res = await fetch(`${SANITY_API}/data/mutate/${DATASET}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      mutations: [{ patch: { id: _id, set: { status: "live" } } }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Sanity patch failed: ${res.status} ${await res.text()}`);
  }
}

type PromotionResult = {
  slug: string;
  title: string;
  catalogNumber?: string;
  promoted: boolean;
  error?: string;
};

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let due: ReleaseRow[];
  try {
    due = await fetchUpcomingDue();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Sanity query failed", detail: msg }, { status: 500 });
  }

  const results: PromotionResult[] = [];

  for (const rel of due) {
    const r: PromotionResult = {
      slug: rel.slug,
      title: rel.title,
      catalogNumber: rel.catalogNumber,
      promoted: false,
    };

    try {
      await patchStatus(rel._id);
      r.promoted = true;
      revalidatePath("/");
      revalidatePath(`/releases/${rel.slug}`);
      revalidatePath("/music");
    } catch (e) {
      r.error = e instanceof Error ? e.message : String(e);
    }

    results.push(r);
  }

  return NextResponse.json(
    {
      promotedCount: results.filter((r) => r.promoted).length,
      candidates: due.length,
      results,
      checkedAt: new Date().toISOString(),
    },
    { status: 200 }
  );
}
