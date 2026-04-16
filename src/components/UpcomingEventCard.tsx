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
    <div className="container-organic overflow-hidden @container">
      <div className={flyerUrl ? "grid grid-cols-2" : ""}>
        {flyerUrl && (
          <div className="aspect-[4/5] relative overflow-hidden">
            <img
              src={flyerUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Info — fluid padding and text, no breakpoint jumps */}
        <div
          className="flex flex-col justify-between"
          style={{ padding: "clamp(0.75rem, 3vw, 1.75rem)" }}
        >
          <div>
            <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: "clamp(0.5rem, 2vw, 1.25rem)" }}>
              <span
                className="container-pill-l inline-block uppercase tracking-wider text-blue-300 border border-blue-300/20 bg-blue-300/5"
                data-label
                style={{ fontSize: "clamp(0.55rem, 1.4vw, 0.875rem)", padding: "0.25rem clamp(0.5rem, 1.5vw, 1rem)" }}
              >
                Upcoming
              </span>
              <span
                className="text-text-muted"
                data-label
                style={{ fontSize: "clamp(0.55rem, 1.4vw, 0.875rem)" }}
              >
                {d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
              </span>
            </div>

            <p
              className="text-blue-300 font-mono font-bold tracking-tight leading-none"
              style={{ fontSize: "clamp(1.1rem, 4vw, 3rem)", marginBottom: "0.15em" }}
            >
              {d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
            </p>
            <p
              className="text-text-muted"
              data-label
              style={{ fontSize: "clamp(0.55rem, 1.2vw, 0.875rem)", marginBottom: "clamp(0.5rem, 2vw, 1.25rem)" }}
            >
              {d.getFullYear()}
            </p>

            <h3
              className="font-black leading-tight text-text-primary"
              style={{ fontSize: "clamp(0.75rem, 2.5vw, 2rem)", marginBottom: "0.2em" }}
            >
              {title}
            </h3>

            {venue && (
              <p
                className="text-text-secondary"
                style={{ fontSize: "clamp(0.55rem, 1.3vw, 0.875rem)" }}
              >
                {venue}
              </p>
            )}
          </div>

          <div>
            {ticketUrl ? (
              <a
                href={ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="container-pill-r inline-flex items-center gap-1.5 w-fit font-semibold bg-blue-300 text-bg-deep hover:bg-blue-200 hover:shadow-[0_0_24px_rgba(124,185,232,0.2)] transition-[background-color,box-shadow]"
                style={{ fontSize: "clamp(0.6rem, 1.5vw, 1rem)", padding: "clamp(0.35rem, 1vw, 0.75rem) clamp(0.6rem, 2vw, 1.5rem)" }}
              >
                Get Tickets
                <ArrowIcon />
              </a>
            ) : (
              <Link
                href="/events"
                className="container-pill-r inline-flex items-center gap-1.5 w-fit font-medium text-blue-300/60 border border-blue-300/20 bg-blue-300/5"
                data-label
                style={{ fontSize: "clamp(0.6rem, 1.5vw, 1rem)", padding: "clamp(0.35rem, 1vw, 0.75rem) clamp(0.6rem, 2vw, 1.5rem)" }}
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
