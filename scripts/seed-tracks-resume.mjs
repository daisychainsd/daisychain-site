import fs from "fs";
import path from "path";

const TOKEN =
  "skh5cxDOo4TMHHye0qlaUFx3mVMqWbsm9IMdQpLaeRrcJ8AXNeA3rH1K6Aqio9unPk0uVtgvMPrSo5FAvx5zUTFKuJnTC4NtWiK69AAdVfd69uwxdPpzdHRK6yi4DdcZnwnwSbJNNzSVm5pPUatYj23gp4NhRlwcmwXrNvB79dyIZMjjdAnQ";
const API = "https://02wrtovm.api.sanity.io/v2024-01-01";
const RELEASES_DIR = path.join(process.env.HOME, "Dropbox/DCR/RELEASES");

async function uploadFile(filePath, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const data = fs.readFileSync(filePath);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000); // 5min timeout
      const res = await fetch(`${API}/assets/files/production`, {
        method: "POST",
        headers: {
          "Content-Type": "audio/wav",
          Authorization: `Bearer ${TOKEN}`,
        },
        body: data,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const text = await res.text();
      const json = JSON.parse(text);
      if (json.document) {
        console.log(`  ✓ Uploaded: ${path.basename(filePath)}`);
        return { _type: "file", asset: { _type: "reference", _ref: json.document._id } };
      }
      console.log(`  ✗ Failed: ${path.basename(filePath)}`);
      return null;
    } catch (e) {
      console.log(`  ⚠ Attempt ${attempt + 1} failed: ${e.message}`);
      if (attempt === retries) return null;
    }
  }
  return null;
}

async function mutate(mutations) {
  const res = await fetch(`${API}/data/mutate/production`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ mutations }),
  });
  return res.json();
}

function findWav(dir, pattern) {
  if (!fs.existsSync(dir)) return null;
  try {
    const files = fs.readdirSync(dir).map(String);
    const match = files.find(
      (f) => f.toLowerCase().includes(pattern.toLowerCase()) && f.endsWith(".wav")
    );
    if (match) return path.join(dir, match);
  } catch {}
  return null;
}

// Remaining releases from where we left off
const RELEASES = [
  {
    id: "release-dcr12",
    folder: "DCR#12",
    tracks: [
      { title: "Cabin", num: 1, dir: "DCR#12", pattern: "Cabin" },
      { title: "Don't Call", num: 2, dir: "DCR#12", pattern: "Call" },
      { title: "Know It", num: 3, dir: "DCR#12", pattern: "Know" },
      { title: "INTHA", num: 4, dir: "DCR#12/DCR#11", pattern: "INTHA" },
    ],
  },
  {
    id: "release-dcr13",
    tracks: [{ title: "v@por", num: 1, dir: "DCR#13", pattern: "por" }],
  },
  {
    id: "release-dcr14",
    tracks: [{ title: "Only One", num: 1, dir: "DCR#14", pattern: "Only One" }],
  },
  {
    id: "release-dcr15",
    tracks: [{ title: "Microjoy", num: 1, dir: "DCR#15", pattern: "Microjoy" }],
  },
  {
    id: "release-dcr16",
    tracks: [{ title: "Vital Loop", num: 1, dir: "DCR#16", pattern: "vital loop" }],
  },
  {
    id: "release-dcr17",
    tracks: [{ title: "the way you want me", num: 1, dir: "DCR#17", pattern: "the way you want me" }],
  },
  {
    id: "release-dcr18",
    tracks: [{ title: "Cocky", num: 1, dir: "DCR#18", pattern: "Cocky" }],
  },
  {
    id: "release-dcr18-5",
    tracks: [{ title: "Cocky (Coido Remix)", num: 1, dir: "DCR#18.5", pattern: "Coido" }],
  },
  {
    id: "release-dcr19",
    tracks: [
      { title: "Heartbeat", num: 1, dir: "DCR#19", pattern: "Heartbeat.wav" },
      { title: "Heartbeat (Extended Version)", num: 2, dir: "DCR#19", pattern: "Extended" },
    ],
  },
  {
    id: "release-dcr20",
    tracks: [
      { title: "Zinc", num: 1, dir: "DCR#20 Dream Disc", pattern: "01 Lilah", artist: "Lilah" },
      { title: "Micro", num: 2, dir: "DCR#20 Dream Disc", pattern: "02 Kelbin", artist: "Kelbin" },
      { title: "Prints", num: 3, dir: "DCR#20 Dream Disc", pattern: "03 Niles", artist: "Niles" },
      { title: "Deeper Permanence", num: 4, dir: "DCR#20 Dream Disc", pattern: "04 Next", artist: "Next To Blue" },
      { title: "Patience", num: 5, dir: "DCR#20 Dream Disc", pattern: "05 Mirror", artist: "Mirror Maze" },
      { title: "UPRES", num: 6, dir: "DCR#20 Dream Disc", pattern: "06 QRTR", artist: "QRTR" },
      { title: "Overthinking", num: 7, dir: "DCR#20 Dream Disc", pattern: "07 Stress", artist: "Stresshead" },
      { title: "task due", num: 8, dir: "DCR#20 Dream Disc", pattern: "08 Cross", artist: "Crosstalk" },
      { title: "Stay For Me", num: 9, dir: "DCR#20 Dream Disc", pattern: "09 JOIA", artist: "JOIA" },
      { title: "Awa Funk", num: 10, dir: "DCR#20 Dream Disc", pattern: "10 Ramon", artist: "RamonPang" },
      { title: "Freedom Farm", num: 11, dir: "DCR#20 Dream Disc", pattern: "11 Levos", artist: "Levos" },
      { title: "Intima", num: 12, dir: "DCR#20 Dream Disc", pattern: "12 canary", artist: "canary yellow ft. Allegra Miles" },
      { title: "What We Dream of", num: 13, dir: "DCR#20 Dream Disc", pattern: "13 Player", artist: "Player Dave x JOIA" },
    ],
  },
  {
    id: "release-dcr21",
    tracks: [
      { title: "Sakima", num: 1, dir: "DCR#21", pattern: "Sakima" },
      { title: "Melted", num: 2, dir: "DCR#21", pattern: "Melted" },
    ],
  },
];

async function main() {
  console.log("=== Resuming track seed ===\n");

  for (const rel of RELEASES) {
    console.log(`\n${rel.id} — ${rel.tracks.length} track(s)`);
    const tracks = [];

    for (const t of rel.tracks) {
      const searchDir = path.join(RELEASES_DIR, t.dir);
      const wavPath = findWav(searchDir, t.pattern);

      let audioFile = null;
      if (wavPath) {
        const sizeMB = fs.statSync(wavPath).size / 1024 / 1024;
        console.log(`  ${t.title}: ${path.basename(wavPath)} (${sizeMB.toFixed(1)}MB)`);
        audioFile = await uploadFile(wavPath);
      } else {
        console.log(`  ${t.title}: ⚠ not found in ${t.dir}`);
      }

      const track = {
        _type: "track",
        _key: `track-${t.num}`,
        title: t.title,
        trackNumber: t.num,
      };
      if (t.artist) track.trackArtist = t.artist;
      if (audioFile) track.audioFile = audioFile;
      tracks.push(track);
    }

    const result = await mutate([{ patch: { id: rel.id, set: { tracks } } }]);
    if (result.error) {
      console.log(`  ✗ Error: ${JSON.stringify(result.error)}`);
    } else {
      console.log(`  ✓ Updated`);
    }
  }

  console.log("\n=== Done! ===");
}

main().catch(console.error);
