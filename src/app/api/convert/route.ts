import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { writeFile, readFile, unlink, rmdir, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import ffmpegPath from "ffmpeg-static";

export const maxDuration = 60;

/** Only allow fetching audio from the Sanity CDN — prevents SSRF. */
const ALLOWED_HOSTS = ["cdn.sanity.io"];

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
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  if (format === "wav") {
    return NextResponse.json({ url: url + "?dl=", direct: true });
  }

  const config = FORMAT_CONFIG[format];

  const dir = await mkdtemp(join(tmpdir(), "dc-"));
  const inputPath = join(dir, "input.wav");
  const outputPath = join(dir, `output.${config.ext}`);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch source audio");

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(inputPath, buffer);

    await new Promise<void>((resolve, reject) => {
      execFile(
        ffmpegPath!,
        ["-i", inputPath, ...config.args, "-y", outputPath],
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
