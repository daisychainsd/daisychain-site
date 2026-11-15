import { Fragment } from "react";
import Link from "next/link";

export interface CreditedArtist { name: string; slug?: string; rosterTier?: string }

/** Homepage card credit line: every credited artist, comma-separated. Falls back to the single
 *  primary artist for releases that predate `artists[]`. Side-tier artists are not linked. */
export default function ArtistCredits({ artists, name, slug }: { artists?: CreditedArtist[] | null; name?: string; slug?: string }) {
  const list = (artists ?? []).filter((a) => a?.name);
  const credits: CreditedArtist[] = list.length > 0 ? list : name ? [{ name, slug }] : [];
  if (credits.length === 0) return null;
  return (
    <p className="text-lg text-blue-300 flex flex-wrap items-baseline gap-x-1.5">
      {credits.map((a, i) => (
        <Fragment key={a.slug || a.name}>
          {a.slug && a.rosterTier !== "side" ? (
            <Link href={`/artists/${a.slug}`} className="hover:text-blue-200 transition-colors">
              {a.name}
            </Link>
          ) : (
            <span>{a.name}</span>
          )}
          {i < credits.length - 1 && <span className="text-text-muted -ml-1.5">,</span>}
        </Fragment>
      ))}
    </p>
  );
}
