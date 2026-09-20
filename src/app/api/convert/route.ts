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

/** Cover art embedded into converted files — same project/dataset pin as audio. */
const ALLOWED_COVER_PREFIX = `https://cdn.sanity.io/images/${
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? ""
}/${process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production"}/`;
const MAX_COVER_BYTES = 5 * 1024 * 1024;

/** Tags written into converted files. Keys are ffmpeg metadata names. */
const TAG_KEYS = ["title", "artist", "album", "album_artist", "track"] as const;

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
  // AIFF is always 16-bit / 44.1 kHz (see aiffCodec).
  // AIFF only carries tags/artwork when the ID3 chunk is switched on.
  aiff: {
    ext: "aiff",
    args: ["-write_id3v2", "1", "-id3v2_version", "3"],
    mime: "audio/aiff",
  },
};

/** Sample rate + bit depth from the WAV "fmt " chunk; 44.1k/16 if unreadable. */
function wavFormat(buf: Buffer): { rate: number; bits: number } {
  const i = buf.indexOf("fmt ", 12, "ascii");
  if (i < 0 || i + 24 > buf.length) return { rate: 44100, bits: 16 };
  return { rate: buf.readUInt32LE(i + 12), bits: buf.readUInt16LE(i + 22) };
}

/**
 * Always 16-bit / 44.1 kHz so the whole catalog downloads in one format.
 * Anything else is resampled and dithered down instead of truncated; a master
 * that already matches is passed through untouched.
 */
function aiffCodec(buf: Buffer): string[] {
  const { rate, bits } = wavFormat(buf);
  const convert =
    bits > 16 || rate !== 44100
      ? ["-af", "aresample=44100:osf=s16:dither_method=triangular"]
      : [];
  return [...convert, "-codec:a", "pcm_s16be"];
}

/** Best effort — a missing cover never blocks the download. */
async function fetchCover(coverUrl: unknown, dest: string): Promise<boolean> {
  if (typeof coverUrl !== "string" || !coverUrl.startsWith(ALLOWED_COVER_PREFIX)) return false;
  try {
    const { origin, pathname } = new URL(coverUrl);
    if (origin !== "https://cdn.sanity.io") return false;
    // Drop caller params; always embed a 1200px JPEG
    const res = await fetch(`${origin}${pathname}?w=1200&h=1200&fit=crop&fm=jpg&q=88`, {
      redirect: "manual",
    });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_COVER_BYTES) return false;
    await writeFile(dest, buf);
    return true;
  } catch {
    return false;
  }
}

/** execFile passes these as argv (no shell), so this is only hygiene + size. */
function tagArgs(meta: unknown): string[] {
  if (!meta || typeof meta !== "object") return [];
  const out: string[] = [];
  for (const key of TAG_KEYS) {
    const v = (meta as Record<string, unknown>)[key];
    if (typeof v !== "string" || !v.trim()) continue;
    out.push("-metadata", `${key}=${v.replace(/[\x00-\x1f]/g, "").slice(0, 200)}`);
  }
  if (out.length) out.push("-metadata", "publisher=Daisy Chain Recordings");
  return out;
}

/** Strip characters that could break Content-Disposition headers. */
function sanitizeFilename(name: string): string {
  return name.replace(/["\\\r\n]/g, "").slice(0, 200);
}

export async function POST(req: NextRequest) {
  const { url, format, filename, coverUrl, meta } = await req.json();

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
  const coverPath = join(dir, "cover.jpg");

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

    const hasCover = await fetchCover(coverUrl, coverPath);
    const coverArgs = hasCover
      ? ["-protocol_whitelist", "file", "-i", coverPath, "-map", "0:a", "-map", "1:v", "-c:v", "copy", "-disposition:v", "attached_pic"]
      : [];

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
          ...coverArgs,
          ...(format === "aiff" ? aiffCodec(buffer) : []),
          ...config.args,
          ...tagArgs(meta),
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
    await unlink(coverPath).catch(() => {});
    await rmdir(dir).catch(() => {});
  }
}
