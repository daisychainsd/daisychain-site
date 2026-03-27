import fs from "fs";
import path from "path";

const TOKEN =
  "skh5cxDOo4TMHHye0qlaUFx3mVMqWbsm9IMdQpLaeRrcJ8AXNeA3rH1K6Aqio9unPk0uVtgvMPrSo5FAvx5zUTFKuJnTC4NtWiK69AAdVfd69uwxdPpzdHRK6yi4DdcZnwnwSbJNNzSVm5pPUatYj23gp4NhRlwcmwXrNvB79dyIZMjjdAnQ";
const API = "https://02wrtovm.api.sanity.io/v2024-01-01";
const RELEASES_DIR = path.join(process.env.HOME, "Dropbox/DCR/RELEASES");

async function uploadFile(filePath) {
  const data = fs.readFileSync(filePath);
  const res = await fetch(`${API}/assets/files/production`, {
    method: "POST",
    headers: {
      "Content-Type": "audio/wav",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: data,
  });
  const json = await res.json();
  if (json.document) {
    console.log(`  ✓ Uploaded: ${path.basename(filePath)}`);
    return { _type: "file", asset: { _type: "reference", _ref: json.document._id } };
  }
  console.log(`  ✗ Failed: ${path.basename(filePath)} — ${JSON.stringify(json)}`);
  return null;
}

async function mutate(mutations) {
  const res = await fetch(`${API}/data/mutate/production`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ mutations }),
  });
  return res.json();
}

function findWav(dir, pattern) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir, { recursive: true }).map(String);
  // Try exact match first
  const exact = files.find((f) => f.endsWith(pattern));
  if (exact) return path.join(dir, exact);
  // Try partial match
  const partial = files.find(
    (f) => f.toLowerCase().includes(pattern.toLowerCase()) && f.endsWith(".wav")
  );
  if (partial) return path.join(dir, partial);
  return null;
}

// Define track lists for each release
const RELEASES = [
  {
    id: "release-dcr01",
    folder: "DCR#01",
    tracks: [{ title: "Hush", num: 1, pattern: "Hush" }],
  },
  {
    id: "release-dcr02",
    folder: "DCR#02",
    tracks: [{ title: "Daydream", num: 1, pattern: "Daydream" }],
  },
  {
    id: "release-dcr2-5",
    folder: "DCR#2.5",
    tracks: [{ title: "Daydream (Player Dave Remix)", num: 1, pattern: "Daydream" }],
  },
  {
    id: "release-dcr07",
    folder: "DCR#07",
    tracks: [
      { title: "Dream Logic", num: 1, pattern: "Dream Logic", subPath: "DCR#03" },
      { title: "goin under", num: 2, pattern: "goin under", subPath: "DCR#04" },
      { title: "You Were The One", num: 3, pattern: "You Were The One", subPath: "../DCR#05" },
      { title: "No One Can See", num: 4, pattern: "No One Can See", subPath: "DCR#06" },
      { title: "Confetti", num: 5, pattern: "Confetti.wav" },
    ],
  },
  {
    id: "release-dcr05",
    folder: "DCR#05",
    tracks: [{ title: "You Were The One", num: 1, pattern: "You Were The One" }],
  },
  {
    id: "release-dcr10",
    folder: "DCR#10",
    tracks: [
      { title: "Badboi", num: 1, pattern: "Badboi", subPath: "DCR#08" },
      { title: "2Kids", num: 2, pattern: "2Kids", subPath: "DCR#09" },
      { title: "Trust Me", num: 3, pattern: "Trust Me" },
      { title: "Close", num: 4, pattern: "Close", artist: "JOIA x Peter Sheppard" },
      { title: "Grit (outro)", num: 5, pattern: "Grit" },
    ],
  },
  {
    id: "release-dcr12",
    folder: "DCR#12",
    tracks: [
      { title: "Cabin", num: 1, pattern: "Cabin" },
      { title: "Don't Call", num: 2, pattern: "Call" },
      { title: "Know It", num: 3, pattern: "Know" },
      { title: "INTHA", num: 4, pattern: "INTHA", subPath: "DCR#11" },
    ],
  },
  {
    id: "release-dcr13",
    folder: "DCR#13",
    tracks: [{ title: "v@por", num: 1, pattern: "por" }],
  },
  {
    id: "release-dcr14",
    folder: "DCR#14",
    tracks: [{ title: "Only One", num: 1, pattern: "Only One" }],
  },
  {
    id: "release-dcr15",
    folder: "DCR#15",
    tracks: [{ title: "Microjoy", num: 1, pattern: "Microjoy" }],
  },
  {
    id: "release-dcr16",
    folder: "DCR#16",
    tracks: [{ title: "Vital Loop", num: 1, pattern: "vital loop" }],
  },
  {
    id: "release-dcr17",
    folder: "DCR#17",
    tracks: [{ title: "the way you want me", num: 1, pattern: "the way you want me" }],
  },
  {
    id: "release-dcr18",
    folder: "DCR#18",
    tracks: [{ title: "Cocky", num: 1, pattern: "Cocky" }],
  },
  {
    id: "release-dcr18-5",
    folder: "DCR#18.5",
    tracks: [{ title: "Cocky (Coido Remix)", num: 1, pattern: "Coido" }],
  },
  {
    id: "release-dcr19",
    folder: "DCR#19",
    tracks: [
      { title: "Heartbeat", num: 1, pattern: "Heartbeat.wav" },
      { title: "Heartbeat (Extended Version)", num: 2, pattern: "Extended" },
    ],
  },
  {
    id: "release-dcr21",
    folder: "DCR#21",
    tracks: [
      { title: "Sakima", num: 1, pattern: "Sakima" },
      { title: "Melted", num: 2, pattern: "Melted" },
    ],
  },
];

async function main() {
  console.log("=== Seeding tracks with audio files ===\n");

  for (const rel of RELEASES) {
    console.log(`\n${rel.id} — ${rel.tracks.length} track(s)`);
    const baseDir = path.join(RELEASES_DIR, rel.folder);
    const tracks = [];

    for (const t of rel.tracks) {
      const searchDir = t.subPath ? path.join(baseDir, t.subPath) : baseDir;
      const wavPath = findWav(searchDir, t.pattern);

      let audioFile = null;
      if (wavPath) {
        const sizeMB = fs.statSync(wavPath).size / 1024 / 1024;
        console.log(`  ${t.title}: found ${path.basename(wavPath)} (${sizeMB.toFixed(1)}MB)`);
        if (sizeMB > 200) {
          console.log(`  ⚠ Skipping upload — file too large (${sizeMB.toFixed(0)}MB)`);
        } else {
          audioFile = await uploadFile(wavPath);
        }
      } else {
        console.log(`  ${t.title}: ⚠ WAV not found`);
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

    // Update the release with tracks
    const result = await mutate([
      {
        patch: {
          id: rel.id,
          set: { tracks },
        },
      },
    ]);

    if (result.error) {
      console.log(`  ✗ Error: ${JSON.stringify(result.error)}`);
    } else {
      console.log(`  ✓ Updated with ${tracks.length} tracks`);
    }
  }

  console.log("\n=== Done! ===");
}

main().catch(console.error);
