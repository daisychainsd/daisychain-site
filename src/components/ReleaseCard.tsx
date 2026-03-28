import Link from "next/link";

interface ReleaseCardProps {
  title: string;
  slug: string;
  artist: string;
  coverUrl: string;
  catalogNumber?: string;
  format?: string[];
}

export default function ReleaseCard({
  title,
  slug,
  artist,
  coverUrl,
  catalogNumber,
}: ReleaseCardProps) {
  return (
    <Link href={`/releases/${slug}`} className="group block">
      <div className="container-organic-md p-2 hover-lift">
        {/* Cover art — inset container */}
        <div className="container-inset-md aspect-square relative overflow-hidden">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={`${title} by ${artist}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-muted text-xs bg-bg-raised">
              {catalogNumber || title}
            </div>
          )}
        </div>

        {/* Metadata inside outer container */}
        <div className="px-3 pt-3 pb-3">
          <p className="text-text-primary font-semibold text-base truncate">{title}</p>
          <p className="text-text-secondary text-sm truncate">{artist}</p>
          {catalogNumber && (
            <p className="text-meta mt-2">{catalogNumber}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
