import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { writeFile, readFile, unlink, rmdir, mkdtemp } from "fs/promises";
import { createReadStream } from "fs";
import { createHmac, timingSafeEqual } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import ffmpegPath from "ffmpeg-static";
import { createClient } from "@sanity/client";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sanity webhook handler — auto-generates 128k MP3 preview files for any
 * tracks on a release that have an audioFile but no previewFile.
 *
 * Triggered by Sanity webhook on release document create/update.
 * Auth: SANITY_WEBHOOK_SECRET shared secret in the webhook config.
 */

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "02wrtovm",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  token: process.env.SANITY_API_TOKEN,
  apiVersion: "2024-01-01",
  useCdn: false,
});

interface Track {
  _key: string;
  title: string;
  audioUrl: string | null;
  hasPreview: boolean;
}

interface ReleasePayload {
  _id: string;
  title: string;
  tracks: Track[] | null;
}

async function convertTrack(
  releaseId: string,
  track: Track,
): Promise<{ title: string; ok: boolean; error?: string }> {
  if (!track.audioUrl) return { title: track.title, ok: false, error: "no audioFile" };

  const dir = await mkdtemp(join(tmpdir(), "dc-preview-"));
  const inputPath = join(dir, "input.wav");
  const outputPath = join(dir, "preview.mp3");

  try {
    const res = await fetch(track.audioUrl);
    if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(inputPath, buf);

    await new Promise<void>((resolve, reject) => {
      execFile(
        ffmpegPath!,
        ["-i", inputPath, "-codec:a", "libmp3lame", "-b:a", "128k", "-y", outputPath],
        { timeout: 120000 },
        (err) => (err ? reject(err) : resolve()),
      );
    });

    const safeName = (track.title || "track").replace(/[^a-zA-Z0-9]/g, "_") + "_preview.mp3";
    const asset = await client.assets.upload("file", createReadStream(outputPath), {
      filename: safeName,
      contentType: "audio/mpeg",
    });

    await client
      .patch(releaseId)
      .set({
        [`tracks[_key=="${track._key}"].previewFile`]: {
          _type: "file",
          asset: { _type: "reference", _ref: asset._id },
        },
      })
      .commit();

    const mp3Size = (await readFile(outputPath)).length;
    return { title: track.title, ok: true, error: undefined };
  } catch (err) {
    return { title: track.title, ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await rmdir(dir).catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  // Auth check — Sanity signs the body with HMAC-SHA256 using the webhook secret
  const secret = process.env.SANITY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SANITY_WEBHOOK_SECRET not configured" }, { status: 503 });
  }

  if (!process.env.SANITY_API_TOKEN) {
    return NextResponse.json({ error: "SANITY_API_TOKEN not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  // Sanity signs webhooks as "t=<timestamp>,v1=<base64url hmac of `${timestamp}.${body}`>"
  const signature = req.headers.get("sanity-webhook-signature");
  const t = signature ? /(?:^|,)t=(\d+)/.exec(signature)?.[1] : null;
  const v1 = signature ? /(?:^|,)v1=([^,]+)/.exec(signature)?.[1] : null;
  if (!t || !v1) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }
  const expected = createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("base64url");
  const a = Buffer.from(v1);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: { _id?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const releaseId = body._id;
  if (!releaseId) {
    return NextResponse.json({ error: "No _id in payload" }, { status: 400 });
  }

  // Fetch the release with track audio info
  const release = await client.fetch<ReleasePayload | null>(
    `*[_type == "release" && _id == $id][0] {
      _id,
      title,
      tracks[] {
        _key,
        title,
        "audioUrl": audioFile.asset->url,
        "hasPreview": defined(previewFile)
      }
    }`,
    { id: releaseId },
  );

  if (!release || !release.tracks) {
    return NextResponse.json({ message: "No tracks found", releaseId });
  }

  // Find tracks that need previews
  const needsPreview = release.tracks.filter((t) => t.audioUrl && !t.hasPreview);

  if (needsPreview.length === 0) {
    return NextResponse.json({
      message: "All tracks already have previews",
      release: release.title,
      trackCount: release.tracks.length,
    });
  }

  console.log(
    `[preview-gen] ${release.title}: generating ${needsPreview.length} preview(s)`,
  );

  const results = [];
  for (const track of needsPreview) {
    const result = await convertTrack(release._id, track);
    results.push(result);
    if (result.ok) {
      console.log(`[preview-gen]   done: ${track.title}`);
    } else {
      console.error(`[preview-gen]   failed: ${track.title} — ${result.error}`);
    }
  }

  return NextResponse.json({
    release: release.title,
    generated: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
