import { createClient } from "@sanity/client";
import { execFile } from "child_process";
import { writeFile, readFile, unlink, mkdtemp, rmdir } from "fs/promises";
import { createReadStream } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import ffmpegPath from "ffmpeg-static";

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  token: process.env.SANITY_API_TOKEN,
  apiVersion: "2024-01-01",
  useCdn: false,
});

const releases = await client.fetch(`
  *[_type == "release"] {
    _id,
    title,
    tracks[] {
      _key,
      title,
      "audioUrl": audioFile.asset->url,
      "hasPreview": defined(previewFile)
    }
  }
`);

let converted = 0;
let skipped = 0;
let failed = 0;

for (const release of releases) {
  if (!release.tracks) continue;

  for (const track of release.tracks) {
    if (!track.audioUrl) {
      skipped++;
      continue;
    }
    if (track.hasPreview) {
      console.log(`  ✓ Skip (has preview): ${track.title}`);
      skipped++;
      continue;
    }

    console.log(`Converting: ${release.title} — ${track.title}`);
    const dir = await mkdtemp(join(tmpdir(), "dc-preview-"));
    const inputPath = join(dir, "input.wav");
    const outputPath = join(dir, "preview.mp3");

    try {
      const res = await fetch(track.audioUrl);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(inputPath, buf);

      await new Promise((resolve, reject) => {
        execFile(
          ffmpegPath,
          ["-i", inputPath, "-codec:a", "libmp3lame", "-b:a", "128k", "-y", outputPath],
          { timeout: 120000 },
          (err) => (err ? reject(err) : resolve())
        );
      });

      const mp3Buf = await readFile(outputPath);
      const asset = await client.assets.upload("file", createReadStream(outputPath), {
        filename: `${track.title.replace(/[^a-zA-Z0-9]/g, "_")}_preview.mp3`,
        contentType: "audio/mpeg",
      });

      await client
        .patch(release._id)
        .set({
          [`tracks[_key=="${track._key}"].previewFile`]: {
            _type: "file",
            asset: { _type: "reference", _ref: asset._id },
          },
        })
        .commit();

      console.log(`  ✓ Done (${(mp3Buf.length / 1024 / 1024).toFixed(1)} MB)`);
      converted++;
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
      failed++;
    } finally {
      await unlink(inputPath).catch(() => {});
      await unlink(outputPath).catch(() => {});
      await rmdir(dir).catch(() => {});
    }
  }
}

console.log(`\nDone! Converted: ${converted}, Skipped: ${skipped}, Failed: ${failed}`);
