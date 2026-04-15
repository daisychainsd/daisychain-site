import Link from "next/link";

interface ReleaseCardProps {
  title: string;
  slug: string;
  artist: string;
  coverUrl: string;
  catalogNumber?: string;
  status?: string;
}

export default function ReleaseCard({
  title,
  slug,
  artist,
  coverUrl,
  catalogNumber,
  status,
}: ReleaseCardProps) {
  const isUpcoming = status === "upcoming";
  return (
    <Link href={`/releases/${slug}`} className="group block min-w-0">
      <div className="container-organic-md p-2 hover-lift">
        {/* Cover art — inset container */}
        <div className="container-inset-md aspect-square relative overflow-hidden">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={`${title} by ${artist}`}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-muted text-xs bg-bg-raised">
              {title}
            </div>
          )}
          {catalogNumber && (
            <span className="absolute bottom-2 left-2 z-10 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-mono text-white/80 backdrop-blur-sm select-none">
              {catalogNumber}
            </span>
          )}
          {isUpcoming && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-blue-950/50">
              <span className="rounded-full bg-blue-300/10 border border-blue-300/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-blue-300 select-none">
                Coming Soon
              </span>
            </div>
          )}
        </div>

        <div className="px-3 pt-3 pb-3">
          <p className="text-text-primary font-semibold text-base truncate">{title.replace(/\s+(EP|Album)$/i, "")}</p>
          <p className="text-text-secondary text-sm truncate">{artist}</p>
        </div>
      </div>
    </Link>
  );
}
