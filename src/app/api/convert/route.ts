import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { writeFile, readFile, unlink, rmdir, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import ffmpegPath from "ffmpeg-static";

export const maxDuration = 60;

/**
 * Only allow fetching audio from THIS project's Sanity dataset. Pinning the
 * host alone was not enough: cdn.sanity.io serves every Sanity customer, so
 * any large public asset anywhere on the CDN was a free lever on our compute
 * and Sanity's egress bill.
 */
const ALLOWED_URL_PREFIX = `https://cdn.sanity.io/files/${
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? ""
}/${process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production"}/`;

/** Refuse anything larger than a long lossless master. */
const MAX_INPUT_BYTES = 200 * 1024 * 1024;

const FORMAT_CONFIG: Record<
  string,
  { ext: string; args: string[]; mime: string }
> = {
  wav: { ext: "wav", args: [], mime: "audio/wav" },
  mp3: {
    ext: "mp3",
    args: ["-codec:a", "libmp3lame", "-b:a", "320k"],
    mime: "audio/mpeg",
  },
  flac: {
    ext: "flac",
    args: ["-codec:a", "flac", "-compression_level", "5"],
    mime: "audio/flac",
  },
  aiff: {
    ext: "aiff",
    args: ["-codec:a", "pcm_s16be"],
    mime: "audio/aiff",
  },
};

/** Strip characters that could break Content-Disposition headers. */
function sanitizeFilename(name: string): string {
  return name.replace(/["\\\r\n]/g, "").slice(0, 200);
}

export async function POST(req: NextRequest) {
  const { url, format, filename } = await req.json();

  if (!url || !format || !FORMAT_CONFIG[format]) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Validate URL against allowlist to prevent SSRF
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "cdn.sanity.io" ||
    !url.startsWith(ALLOWED_URL_PREFIX)
  ) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  if (format === "wav") {
    // Named `dl` param makes Sanity set Content-Disposition with a real
    // filename instead of the asset hash
    const dl = filename ? encodeURIComponent(`${sanitizeFilename(filename)}.wav`) : "";
    return NextResponse.json({ url: `${url}?dl=${dl}`, direct: true });
  }

  const config = FORMAT_CONFIG[format];

  const dir = await mkdtemp(join(tmpdir(), "dc-"));
  const inputPath = join(dir, "input.wav");
  const outputPath = join(dir, `output.${config.ext}`);

  try {
    // redirect: "manual" — the allowlist is checked once, before the request.
    // Following a redirect would let a future CDN change land us somewhere the
    // allowlist never approved.
    const response = await fetch(url, { redirect: "manual" });
    if (!response.ok) throw new Error("Failed to fetch source audio");

    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_INPUT_BYTES) {
      return NextResponse.json({ error: "Source audio too large" }, { status: 413 });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_INPUT_BYTES) {
      return NextResponse.json({ error: "Source audio too large" }, { status: 413 });
    }
    await writeFile(inputPath, buffer);

    await new Promise<void>((resolve, reject) => {
      execFile(
        ffmpegPath!,
        [
          // Force the WAV demuxer and deny every protocol but local file
          // reads. Input is always a Sanity WAV in the real flow, so this
          // costs nothing and removes ffmpeg's demuxer/protocol attack
          // surface (HLS/concat playlists referencing file:// paths).
          "-f",
          "wav",
          "-protocol_whitelist",
          "file",
          "-i",
          inputPath,
          ...config.args,
          "-y",
          outputPath,
        ],
        { timeout: 55000 },
        (error) => {
          if (error) reject(error);
          else resolve();
        }
      );
    });

    const outputBuffer = await readFile(outputPath);
    const safeName = sanitizeFilename(
      filename ? `${filename}.${config.ext}` : `track.${config.ext}`,
    );

    return new NextResponse(outputBuffer, {
      headers: {
        "Content-Type": config.mime,
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": outputBuffer.length.toString(),
      },
    });
  } catch (err) {
    console.error("Conversion failed:", err);
    return NextResponse.json(
      { error: "Conversion failed" },
      { status: 500 }
    );
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await rmdir(dir).catch(() => {});
  }
}
