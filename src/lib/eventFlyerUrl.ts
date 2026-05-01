import { urlFor } from "@/sanity/image";

/** Used when Sanity has no value yet (legacy events). */
export const DEFAULT_FLYER_VERTICAL_ALIGN = 85;

/**
 * Proportional flyer URL (full aspect ratio). Pair with a fixed aspect box +
 * `object-cover` and `objectPosition` from `flyerObjectPosition()`.
 */
export function eventFlyerUrl(source: unknown, width = 800) {
  return urlFor(source).width(width).url();
}

/** CSS `object-position` for vertical framing only (`center` + Y%). */
export function flyerObjectPosition(alignY?: number | null): `center ${number}%` {
  const raw =
    alignY == null || Number.isNaN(Number(alignY))
      ? DEFAULT_FLYER_VERTICAL_ALIGN
      : Number(alignY);
  const y = Math.min(100, Math.max(0, raw));
  return `center ${y}%`;
}
