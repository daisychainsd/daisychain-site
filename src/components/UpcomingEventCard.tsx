import Link from "next/link";

export interface UpcomingEventCardProps {
  title: string;
  date: string;
  venue?: string;
  flyerUrl?: string;
  ticketUrl?: string;
  lineup?: { name: string; artistSlug?: string }[];
}

export default function UpcomingEventCard({
  title,
  date,
  venue,
  flyerUrl,
  ticketUrl,
  lineup,
}: UpcomingEventCardProps) {
  const d = new Date(date);

  return (
    <div className="container-organic p-3 sm:p-4">
      <div className="grid md:grid-cols-2 gap-6 md:gap-8">
        {flyerUrl && (
          <div className="container-inset aspect-[4/5] relative overflow-hidden">
            <img
              src={flyerUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex flex-col justify-between p-4 sm:p-6">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span
                className="container-pill-l inline-block px-4 py-1.5 text-sm uppercase tracking-wider text-blue-300 border border-blue-300/20 bg-blue-300/5"
                data-label
              >
                Upcoming
              </span>
              <span className="text-text-muted text-sm" data-label>
                {d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
              </span>
            </div>

            <p className="text-blue-300 font-mono text-4xl sm:text-5xl font-bold tracking-tight mb-1">
              {d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
            </p>
            <p className="text-text-muted text-sm mb-6" data-label>
              {d.getFullYear()}
            </p>

            <h2 className="text-headline mb-2">{title}</h2>

            {venue && (
              <p className="text-text-secondary text-base mb-6">{venue}</p>
            )}
          </div>

          <div>
            {lineup && lineup.length > 0 && (
              <div className="mb-6 pt-6 border-t border-blue-300/10">
                <p className="text-label mb-3">Lineup</p>
                <div className="flex flex-col gap-1.5">
                  {lineup.map((act) => (
                    <div key={act.name}>
                      {act.artistSlug ? (
                        <a
                          href={`/artists/${act.artistSlug}`}
                          className="text-blue-300 hover:underline text-xl"
                        >
                          {act.name}
                        </a>
                      ) : (
                        <span className="text-text-primary text-xl">{act.name}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ticketUrl ? (
              <a
                href={ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="container-pill-r inline-flex items-center gap-2 w-fit text-base font-semibold px-6 py-3 bg-blue-300 text-bg-deep hover:bg-blue-200 hover:shadow-[0_0_24px_rgba(124,185,232,0.2)] transition-[background-color,box-shadow]"
              >
                Get Tickets
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8h10m0 0l-4-4m4 4l-4 4" />
                </svg>
              </a>
            ) : (
              <Link
                href="/events"
                className="container-pill-r inline-flex items-center gap-2 w-fit text-base font-medium px-6 py-3 text-blue-300/60 border border-blue-300/20 bg-blue-300/5"
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
