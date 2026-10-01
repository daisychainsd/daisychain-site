import type { CSSProperties } from "react";
import type { ThumbnailCrop } from "./types";

export function isThumbnailCrop(value: unknown): value is ThumbnailCrop {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const crop = value as Record<string, unknown>;
  return typeof crop.zoom === "number" && Number.isFinite(crop.zoom) && crop.zoom >= 1 && crop.zoom <= 3 &&
    typeof crop.x === "number" && Number.isFinite(crop.x) && crop.x >= 0 && crop.x <= 100 &&
    typeof crop.y === "number" && Number.isFinite(crop.y) && crop.y >= 0 && crop.y <= 100;
}

/** Identical framing in Ops, shop cards and product galleries; original files stay intact. */
export function thumbnailStyle(crop?: ThumbnailCrop): CSSProperties {
  if (!isThumbnailCrop(crop)) return { objectFit: "contain" };
  const position = `${crop.x}% ${crop.y}%`;
  return { objectFit: "cover", objectPosition: position, transform: `scale(${crop.zoom})`, transformOrigin: position };
}
