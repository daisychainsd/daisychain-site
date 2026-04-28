import Link from "next/link";
import { ArrowIcon } from "./icons";

export interface UpcomingEventCardProps {
  title: string;
  date: string;
  venue?: string;
  flyerUrl?: string;
  ticketUrl?: string;
}

export default function UpcomingEventCard({
  title,
  date,
  venue,
  flyerUrl,
  ticketUrl,
}: UpcomingEventCardProps) {
  const d = new Date(date);

  return (
    <div className="h-full container-organic overflow-hidden p-3 sm:p-4">
      <div className={flyerUrl ? "grid md:grid-cols-2 gap-8 h-full" : "h-full"}>
        {flyerUrl && (
          <div className="container-inset aspect-square relative overflow-hidden">
            <img
              src={flyerUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Info — two-zone rhythm: top block of metadata, divider, full-width CTA pinned bottom */}
        {/* md+ removes inner padding so content aligns top + bottom with image edges */}
        <div className="flex flex-col justify-between p-4 sm:p-6 md:p-0">
          {/* TOP ZONE */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="container-pill-l inline-block uppercase tracking-wider text-blue-300 border border-blue-300/20 bg-blue-300/5 text-xs px-3 py-1"
                data-label
              >
                Upcoming
              </span>
              <span className="text-text-muted text-xs" data-label>
                {d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
              </span>
            </div>

            <p
              className="text-blue-300 font-mono font-bold tracking-tight leading-none"
              style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)" }}
            >
              {d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
            </p>
            {/* year visible on mobile stacked only — md+ trims for compactness */}
            <p className="text-text-muted text-xs md:hidden" data-label>
              {d.getFullYear()}
            </p>

            <h3 className="font-black leading-tight text-text-primary mt-1 text-2xl md:text-xl">
              {title}
            </h3>

            {venue && (
              <p className="text-text-secondary text-sm">{venue}</p>
            )}
          </div>

          {/* BOTTOM ZONE */}
          <div className="border-t border-blue-300/10 pt-5 mt-5">
            {ticketUrl ? (
              <a
                href={ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="container-pill-r flex w-full items-center justify-center gap-2 px-6 py-3 text-sm font-semibold bg-blue-300 text-bg-deep hover:bg-blue-200 hover:shadow-[0_0_24px_rgba(124,185,232,0.2)] transition-[background-color,box-shadow]"
              >
                Get Tickets
                <ArrowIcon />
              </a>
            ) : (
              <Link
                href="/events"
                className="container-pill-r flex w-full items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-blue-300/80 border border-blue-300/20 bg-blue-300/5"
                data-label
              >
                View Events
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
