import { Zip, ZipPassThrough } from "fflate";

export type ZipFormat = "wav" | "flac" | "aiff" | "mp3";

export interface ZipTrack {
  audioUrl: string;
  /** Filename inside the zip, without extension — e.g. "01 Artist - Title" */
  baseName: string;
}

/**
 * Download an album as a single zip instead of firing one download per track.
 * Chromium (Brave especially) throttles/blocks multiple programmatic
 * downloads, which silently dropped half the tracks — one zip sidesteps the
 * whole "multiple automatic downloads" policy.
 *
 * Tracks are fetched sequentially and streamed straight into a stored
 * (uncompressed — audio doesn't compress) zip, so peak memory ≈ zip size.
 */
export async function downloadTracksAsZip(
  tracks: ZipTrack[],
  format: ZipFormat,
  zipName: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const chunks: Uint8Array[] = [];
  let zipError: Error | null = null;
  const zip = new Zip((err, chunk) => {
    if (err) zipError = err;
    else if (chunk) chunks.push(chunk);
  });

  for (let i = 0; i < tracks.length; i++) {
    onProgress?.(i, tracks.length);
    const track = tracks[i];

    const res =
      format === "wav"
        ? await fetch(track.audioUrl)
        : await fetch("/api/convert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: track.audioUrl,
              format,
              filename: track.baseName,
            }),
          });
    if (!res.ok || !res.body) {
      zip.terminate();
      throw new Error(`Failed to fetch "${track.baseName}"`);
    }

    const entry = new ZipPassThrough(`${track.baseName}.${format}`);
    zip.add(entry);
    const reader = res.body.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      entry.push(value);
    }
    entry.push(new Uint8Array(0), true);
    if (zipError) throw zipError;
  }
  zip.end();
  onProgress?.(tracks.length, tracks.length);

  const blob = new Blob(chunks as BlobPart[], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${zipName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
