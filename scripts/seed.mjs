import fs from "fs";
import path from "path";

const PROJECT_ID = "02wrtovm";
const DATASET = "production";
const TOKEN =
  "skh5cxDOo4TMHHye0qlaUFx3mVMqWbsm9IMdQpLaeRrcJ8AXNeA3rH1K6Aqio9unPk0uVtgvMPrSo5FAvx5zUTFKuJnTC4NtWiK69AAdVfd69uwxdPpzdHRK6yi4DdcZnwnwSbJNNzSVm5pPUatYj23gp4NhRlwcmwXrNvB79dyIZMjjdAnQ";
const API = `https://${PROJECT_ID}.api.sanity.io/v2024-01-01`;
const RELEASES_DIR = path.join(process.env.HOME, "Dropbox/DCR/RELEASES");

// ── Artist list (unique) ──
const ARTISTS = [
  "Hush",
  "Mirror Maze",
  "Player Dave",
  "Canary Yellow",
  "Next To Blue",
  "JOIA",
  "Peter Sheppard",
  "Grit",
  "Intha",
  "Crosstalk",
  "Kelbin",
  "Elohim",
  "Niles",
  "Belay",
  "Allegra Miles",
  "Lilah",
  "QRTR",
  "Stresshead",
  "RamonPang",
  "Levos",
];

// ── Releases ──
const RELEASES = [
  { cat: "DCR#01", title: "Hush", artists: ["Hush"], folder: "DCR#01", artPatterns: ["HUSH ARTWORK FINAL.jpg"] },
  { cat: "DCR#02", title: "Daydream", artists: ["Mirror Maze"], folder: "DCR#02", artPatterns: ["EP COVER ART.png"] },
  { cat: "DCR#2.5", title: "Daydream (Player Dave Remix)", artists: ["Player Dave"], folder: "DCR#2.5", artPatterns: ["DAYDREAM PD REMIXcover art -.jpg"] },
  { cat: "DCR#03", title: "Dream Logic", artists: ["Player Dave"], folder: "DCR#07", subPath: "DCR#03" },
  { cat: "DCR#04", title: "goin under", artists: ["Player Dave"], folder: "DCR#07", subPath: "DCR#04" },
  { cat: "DCR#05", title: "You Were The One", artists: ["Canary Yellow"], folder: "DCR#05", artPatterns: ["you were the one art.png", "you were the one art copy.jpg"] },
  { cat: "DCR#06", title: "No One Can See", artists: ["Player Dave", "Next To Blue"], folder: "DCR#07", subPath: "DCR#06" },
  { cat: "DCR#07", title: "Confetti", artists: ["Player Dave"], folder: "DCR#07", artPatterns: ["and then i start floating art.jpg"] },
  { cat: "DCR#08", title: "Badboi", artists: ["JOIA", "Player Dave"], folder: "DCR#10", subPath: "DCR#08" },
  { cat: "DCR#09", title: "2Kids", artists: ["JOIA"], folder: "DCR#10", subPath: "DCR#09" },
  { cat: "DCR#10", title: "Trust Me", artists: ["JOIA"], folder: "DCR#10" },
  { cat: "DCR#11", title: "Intha", artists: ["Intha"], folder: "DCR#12", subPath: "DCR#11" },
  { cat: "DCR#12", title: "URL;;irl", artists: ["Crosstalk"], folder: "DCR#12", artPatterns: ["20250428_CROSSTALK_EP-cover.png"] },
  { cat: "DCR#13", title: "v@por", artists: ["Player Dave"], folder: "DCR#13" },
  { cat: "DCR#14", title: "Only One", artists: ["Next To Blue"], folder: "DCR#14", artPatterns: ["Only One - Cover Art.png"] },
  { cat: "DCR#15", title: "Microjoy", artists: ["Player Dave", "Canary Yellow"], feat: "Allegra Miles", folder: "DCR#15", artPatterns: ["Player dave - Cover art 1.jpg"] },
  { cat: "DCR#16", title: "Vital Loop", artists: ["Kelbin"], folder: "DCR#16", artPatterns: ["Kelbin_VitalArt_2025.png"] },
  { cat: "DCR#17", title: "the way you want me", artists: ["Player Dave", "Elohim"], folder: "DCR#17", artPatterns: ["S2 2.jpg"] },
  { cat: "DCR#18", title: "Cocky", artists: ["Mirror Maze", "Niles"], folder: "DCR#18", artPatterns: ["Niles&MirrorMaze_CockyArtwork_2025.png"] },
  { cat: "DCR#18.5", title: "Cocky (Coido Remix)", artists: ["Mirror Maze", "Niles"], folder: "DCR#18.5", artPatterns: ["Niles&MirrorMaze_CockyArtworkRMX_2025.png"] },
  { cat: "DCR#19", title: "Heartbeat", artists: ["Player Dave", "Elohim"], folder: "DCR#19", artPatterns: ["Heartbeat EP Cover.jpg"] },
  { cat: "DCR#20", title: "Dream Disc", artists: ["Player Dave"], isCompilation: true, folder: "DCR#20 Dream Disc", artPatterns: ["DCR VA FRONT (FINAL).jpg"] },
  { cat: "DCR#21", title: "Sakima / Melted", artists: ["Belay"], folder: "DCR#21", artPatterns: ["Belay - Sakima:Melted EP artwork.png"] },
];

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[@#]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function sanityMutate(mutations) {
  const res = await fetch(`${API}/data/mutate/${DATASET}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ mutations }),
  });
  const json = await res.json();
  if (json.error) throw new Error(JSON.stringify(json));
  return json;
}

async function uploadImage(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const data = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === ".png" ? "image/png" : ext === ".jpeg" || ext === ".jpg" ? "image/jpeg" : "image/jpeg";

  const res = await fetch(`${API}/assets/images/${DATASET}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Authorization: `Bearer ${TOKEN}`,
    },
    body: data,
  });
  const json = await res.json();
  if (json.document) {
    console.log(`  ✓ Uploaded image: ${path.basename(filePath)}`);
    return { _type: "image", asset: { _type: "reference", _ref: json.document._id } };
  }
  console.log(`  ✗ Failed to upload: ${path.basename(filePath)}`);
  return null;
}

function findArt(releaseDir, patterns) {
  if (!patterns) {
    // Try to find any image in Assets or ART subfolders
    for (const sub of ["Assets", "ART", "ART/COVER", "Art", "assets", ""]) {
      const dir = path.join(releaseDir, sub);
      if (!fs.existsSync(dir)) continue;
      try {
        const files = fs.readdirSync(dir);
        const img = files.find((f) => /\.(jpg|jpeg|png)$/i.test(f) && !f.startsWith("."));
        if (img) return path.join(dir, img);
      } catch {}
    }
    return null;
  }

  for (const pattern of patterns) {
    // Check root, Assets, ART, ART/COVER, ART/HUSH COVER
    for (const sub of ["", "Assets", "ART", "ART/COVER", "ART/HUSH COVER", "Art"]) {
      const p = path.join(releaseDir, sub, pattern);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

async function main() {
  console.log("=== Seeding Daisy Chain catalog ===\n");

  // 1. Create artists
  console.log("Creating artists...");
  const artistIds = {};
  const artistMutations = ARTISTS.map((name) => {
    const id = `artist-${slugify(name)}`;
    artistIds[name] = id;
    return {
      createOrReplace: {
        _id: id,
        _type: "artist",
        name,
        slug: { _type: "slug", current: slugify(name) },
      },
    };
  });
  await sanityMutate(artistMutations);
  console.log(`✓ Created ${ARTISTS.length} artists\n`);

  // 2. Create releases with cover art
  console.log("Creating releases with cover art...\n");
  for (const rel of RELEASES) {
    console.log(`${rel.cat} — ${rel.title}`);

    const releaseDir = rel.subPath
      ? path.join(RELEASES_DIR, rel.folder, rel.subPath)
      : path.join(RELEASES_DIR, rel.folder);

    // Find and upload cover art
    let coverArt = null;
    const artPath = findArt(releaseDir, rel.artPatterns);
    if (artPath) {
      coverArt = await uploadImage(artPath);
    } else {
      // Try parent folder if subPath
      if (rel.subPath) {
        const parentArt = findArt(path.join(RELEASES_DIR, rel.folder), rel.artPatterns);
        if (parentArt) coverArt = await uploadImage(parentArt);
      }
      if (!coverArt) console.log("  ⚠ No cover art found");
    }

    // Primary artist (first one)
    const primaryArtist = rel.artists[0];
    const artistRef = artistIds[primaryArtist];

    const displayTitle = rel.feat
      ? `${rel.title} (feat. ${rel.feat})`
      : rel.title;

    const doc = {
      _id: `release-${slugify(rel.cat)}`,
      _type: "release",
      title: displayTitle,
      slug: { _type: "slug", current: slugify(rel.cat + "-" + rel.title) },
      artist: { _type: "reference", _ref: artistRef },
      catalogNumber: rel.cat,
      format: ["digital"],
    };

    if (coverArt) doc.coverArt = coverArt;

    await sanityMutate([{ createOrReplace: doc }]);
    console.log(`  ✓ Created\n`);
  }

  // 3. Update Player Dave with links and photo
  console.log("Updating Player Dave profile...");
  await sanityMutate([
    {
      patch: {
        id: "artist-player-dave",
        set: {
          links: {
            _type: "object",
            website: "https://playerdave.com",
            instagram: "https://www.instagram.com/playerdave",
            bandcamp: "https://playerdave.bandcamp.com/",
            soundcloud: "https://soundcloud.com/playerdave",
          },
        },
      },
    },
  ]);
  console.log("✓ Done\n");

  console.log("=== Catalog seeded! Refresh your site. ===");
}

main().catch(console.error);
