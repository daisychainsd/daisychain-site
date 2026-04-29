#!/usr/bin/env node
/**
 * Migrate per-track artist credits from the legacy `trackArtist` string field
 * to the new `trackArtists[]` array of references, so each name renders as a
 * separate clickable link instead of "X & Y" plain text.
 *
 *   node scripts/migrate-track-artists.mjs           preview only
 *   node scripts/migrate-track-artists.mjs --apply   create missing artists + patch tracks
 *
 * Scope: tracks with `&` in the trackArtist string (multi-artist credits) AND
 * single-artist tracks on Dream Disc (DCR#20, since each compilation track
 * has its own artist worth linking). Other single-artist tracks are skipped
 * since they fall back to the parent release's artists[] correctly.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const PROJECT_ID = "02wrtovm";
const DATASET = "production";
const TOKEN =
  "skh5cxDOo4TMHHye0qlaUFx3mVMqWbsm9IMdQpLaeRrcJ8AXNeA3rH1K6Aqio9unPk0uVtgvMPrSo5FAvx5zUTFKuJnTC4NtWiK69AAdVfd69uwxdPpzdHRK6yi4DdcZnwnwSbJNNzSVm5pPUatYj23gp4NhRlwcmwXrNvB79dyIZMjjdAnQ";
const SANITY_API = `https://${PROJECT_ID}.api.sanity.io/v2024-01-01`;
const PREVIEW_FILE = path.resolve(process.cwd(), "track-artists-migration-preview.json");

const APPLY = process.argv.includes("--apply");

// ── Sanity helpers ──

async function fetchSanity(query) {
  const url = `${SANITY_API}/data/query/${DATASET}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) throw new Error(`Sanity query failed: ${res.status} ${await res.text()}`);
  return (await res.json()).result;
}

async function mutateSanity(mutations) {
  const res = await fetch(`${SANITY_API}/data/mutate/${DATASET}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ mutations }),
  });
  if (!res.ok) throw new Error(`Sanity mutate failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ── Name parsing ──

function parseNames(rawTrackArtist) {
  if (!rawTrackArtist) return [];
  // Split on "&" (with optional whitespace), keep names that survive trimming.
  // We don't try to handle "feat." style suffixes — by convention DCR puts those
  // in track titles, not in trackArtist.
  return rawTrackArtist
    .split(/\s*&\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeNameForMatch(s) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Mode: preview ──

async function runPreview() {
  console.log("Fetching artists + releases…");
  const [artists, releases] = await Promise.all([
    fetchSanity(`*[_type=="artist"]{_id, name, "slug": slug.current}`),
    fetchSanity(
      `*[_type=="release" && hidden!=true]|order(catalogNumber asc){
        _id, _rev, catalogNumber, title, "slug": slug.current,
        tracks[]{_key, title, trackArtist, "hasNew": count(trackArtists) > 0}
      }`,
    ),
  ]);

  // Index artists by normalized name.
  const artistByName = new Map();
  for (const a of artists) {
    artistByName.set(normalizeNameForMatch(a.name), a);
  }

  console.log(`  ${artists.length} artists, ${releases.length} releases`);

  const migrations = [];
  const missingArtistsMap = new Map(); // name → { name, slug }

  for (const rel of releases) {
    if (!Array.isArray(rel.tracks)) continue;
    const isDreamDisc = rel.catalogNumber === "DCR#20";

    for (const track of rel.tracks) {
      if (track.hasNew) continue; // already migrated, skip
      const credit = track.trackArtist;
      if (!credit) continue; // no string to migrate from; falls back to release artists
      const isMulti = credit.includes("&");
      if (!isMulti && !isDreamDisc) continue; // single-artist non-comp tracks: skip per scope

      const names = parseNames(credit);
      if (names.length === 0) continue;

      const refs = [];
      const newOnThisTrack = [];

      for (const name of names) {
        const matched = artistByName.get(normalizeNameForMatch(name));
        if (matched) {
          refs.push({ _id: matched._id, name: matched.name, slug: matched.slug });
        } else {
          const slug = slugify(name);
          const newDoc = { name, slug };
          newOnThisTrack.push(newDoc);
          if (!missingArtistsMap.has(slug)) {
            missingArtistsMap.set(slug, newDoc);
          }
          refs.push({ _id: `artist-${slug}`, name, slug, isNew: true });
        }
      }

      migrations.push({
        releaseId: rel._id,
        catalogNumber: rel.catalogNumber,
        releaseTitle: rel.title,
        trackKey: track._key,
        trackTitle: track.title,
        existingTrackArtist: credit,
        newTrackArtists: refs,
        ...(newOnThisTrack.length > 0 ? { creates: newOnThisTrack } : {}),
      });
    }
  }

  const newArtistDocs = Array.from(missingArtistsMap.values()).map((doc) => ({
    _id: `artist-${doc.slug}`,
    _type: "artist",
    name: doc.name,
    slug: { _type: "slug", current: doc.slug },
    rosterTier: "side",
  }));

  const out = { newArtistDocs, migrations };
  fs.writeFileSync(PREVIEW_FILE, JSON.stringify(out, null, 2));

  console.log("\n── Preview summary ──");
  console.log(`Tracks to migrate:     ${migrations.length}`);
  console.log(`New artist docs:       ${newArtistDocs.length}`);
  if (newArtistDocs.length > 0) {
    for (const a of newArtistDocs) {
      console.log(`  + create  ${a.name.padEnd(20)} (slug ${a.slug.current}, side tier)`);
    }
  }
  console.log("\nPer track:");
  for (const m of migrations) {
    const names = m.newTrackArtists.map((r) => r.name + (r.isNew ? "*" : "")).join(", ");
    console.log(`  ${m.catalogNumber.padEnd(10)} ${m.trackTitle.padEnd(36)}  →  ${names}`);
  }
  if (migrations.some((m) => m.newTrackArtists.some((r) => r.isNew))) {
    console.log("\n  * = new artist doc that will be created on --apply");
  }
  console.log(`\nPreview written to: ${PREVIEW_FILE}`);
  console.log("Run with --apply to execute.");
}

// ── Mode: apply ──

async function runApply() {
  if (!fs.existsSync(PREVIEW_FILE)) {
    console.error(`No preview at ${PREVIEW_FILE}. Run without --apply first.`);
    process.exit(1);
  }
  const { newArtistDocs, migrations } = JSON.parse(fs.readFileSync(PREVIEW_FILE, "utf8"));

  // 1. Create any new artist docs first (createIfNotExists is idempotent).
  if (newArtistDocs.length > 0) {
    console.log(`Creating ${newArtistDocs.length} new artist docs…`);
    const mutations = newArtistDocs.map((doc) => ({ createIfNotExists: doc }));
    await mutateSanity(mutations);
    for (const a of newArtistDocs) {
      console.log(`  ✓ ${a.name}  (${a._id}, side tier)`);
    }
  }

  // 2. Patch each release: add trackArtists[] to the matching track via _key path.
  console.log(`\nPatching ${migrations.length} tracks…`);
  let ok = 0;
  let fail = 0;
  for (const m of migrations) {
    const refs = m.newTrackArtists.map((r) => ({
      _key: crypto.randomUUID().slice(0, 12),
      _ref: r._id,
      _type: "reference",
    }));
    try {
      await mutateSanity([
        {
          patch: {
            id: m.releaseId,
            set: {
              [`tracks[_key=="${m.trackKey}"].trackArtists`]: refs,
            },
          },
        },
      ]);
      const names = m.newTrackArtists.map((r) => r.name).join(", ");
      console.log(`  ✓ ${m.catalogNumber.padEnd(10)} ${m.trackTitle.padEnd(36)}  →  ${names}`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${m.catalogNumber} ${m.trackTitle}: ${e.message}`);
      fail++;
    }
  }

  console.log(`\n── Done ──\nApplied: ${ok}\nFailed:  ${fail}`);
}

// ── Main ──

(async () => {
  try {
    if (APPLY) await runApply();
    else await runPreview();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
