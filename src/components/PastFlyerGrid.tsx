import { flyerObjectPosition } from "@/lib/eventFlyerUrl";

/**
 * Decorative mosaic of past show flyers (no links, no captions).
 * Parent filters to events that already have a Sanity `flyer` image.
 *
 * Vertical framing: event `flyerVerticalAlign` + CSS `object-position`.
 */
export interface PastFlyerTile {
  slug: string;
  imageUrl: string;
  flyerVerticalAlign?: number;
}

export default function PastFlyerGrid({ tiles }: { tiles: PastFlyerTile[] }) {
  if (tiles.length === 0) return null;

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8"
      aria-label="Past show flyers"
    >
      {tiles.map((tile) => (
        <div key={tile.slug} className="min-w-0">
          <div className="container-organic-md p-2 overflow-hidden">
            <div className="container-inset-md aspect-square relative overflow-hidden bg-bg-raised">
              <img
                src={tile.imageUrl}
                alt=""
                aria-hidden
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover pointer-events-none select-none"
                style={{ objectPosition: flyerObjectPosition(tile.flyerVerticalAlign) }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
