import { sanityFetch } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import { EVENTS_LIST } from "@/lib/queries";
import type { Event } from "@/lib/types";
import EventsToggle from "@/components/EventsToggle";

export default async function EventsPage() {
  const events = await sanityFetch<Event>(EVENTS_LIST);

  const now = new Date().toISOString();
  const upcoming = events.filter((e) => e.date >= now);
  const past = events.filter((e) => e.date < now);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 relative">
      <div className="blob w-[400px] h-[400px] bg-lavender-300 top-[-100px] right-[-150px] animate-drift" />

      <div className="flex items-end justify-between mb-10 gap-4 flex-wrap">
        <div>
          <p className="text-label mb-2">Live</p>
          <h1 className="text-headline text-text-primary">Events</h1>
        </div>
        {(upcoming.length > 0 && past.length > 0) && (
          <EventsToggle upcomingCount={upcoming.length} pastCount={past.length} />
        )}
      </div>

      {events.length === 0 && (
        <p className="text-text-muted text-center py-20">
          No events yet — add them at{" "}
          <a href="/studio" className="text-blue-300 hover:underline">
            /studio
          </a>
        </p>
      )}

      {upcoming.length > 0 && (
        <section id="upcoming" className="mb-16 scroll-mt-28">
          <div className="space-y-8">
            {upcoming.map((event) => (
              <UpcomingCard key={event.slug} event={event} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section id="past" className="scroll-mt-28">
          <div className="divider-glow mb-8" />
          <p className="text-label mb-6">Past Events</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {past.map((event) => (
              <PastCard key={event.slug} event={event} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function UpcomingCard({ event }: { event: Event }) {
  const date = new Date(event.date);

  return (
    <div className="container-organic p-3 sm:p-4">
      <div className="grid md:grid-cols-2 gap-6 md:gap-8">
        {event.flyer && (
          <div className="container-inset aspect-[4/5] relative">
            <img
              src={urlFor(event.flyer).width(800).url()}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex flex-col justify-center p-2 sm:p-4">
          <span
            className="container-pill-l inline-block w-fit px-4 py-1.5 text-sm uppercase tracking-wider text-amber-300 border border-amber-300/20 bg-amber-300/5 mb-4"
            data-mono
          >
            Upcoming
          </span>

          <p className="text-amber-300 text-lg font-semibold mb-1">
            {date.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>

          <h2 className="text-headline mb-3">{event.title}</h2>

          {event.venue && (
            <p className="text-text-secondary text-base mb-4">{event.venue}</p>
          )}

          {event.lineup && event.lineup.length > 0 && (
            <div className="mb-6">
              <p className="text-label mb-2">Lineup</p>
              <div className="flex flex-wrap gap-x-2 gap-y-1 text-xl">
                {event.lineup.map((act, i) => (
                  <span key={act.name} className="flex items-baseline gap-x-2">
                    {i > 0 && <span className="text-text-muted">/</span>}
                    {act.artistSlug ? (
                      <a
                        href={`/artists/${act.artistSlug}`}
                        className="text-blue-300 hover:underline"
                      >
                        {act.name}
                      </a>
                    ) : (
                      <span className="text-text-primary">{act.name}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {event.ticketUrl ? (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="container-pill-r inline-flex items-center gap-2 w-fit text-base font-semibold px-6 py-3 bg-amber-300 text-bg-deep hover:bg-amber-400 hover:shadow-[0_0_24px_rgba(232,184,108,0.2)] transition-all"
            >
              Get Tickets
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10m0 0l-4-4m4 4l-4 4" />
              </svg>
            </a>
          ) : (
            <span
              className="container-pill-r inline-flex items-center gap-2 w-fit text-base font-medium px-6 py-3 text-amber-300/60 border border-amber-300/20 bg-amber-300/5"
              data-mono
            >
              Tickets Coming Soon
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PastCard({ event }: { event: Event }) {
  const date = new Date(event.date);

  return (
    <div className="container-organic overflow-hidden group hover-lift">
      <div className="relative aspect-[4/5]">
        {event.flyer ? (
          <img
            src={urlFor(event.flyer).width(600).url()}
            alt={event.title}
            className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity duration-300"
          />
        ) : (
          <div className="w-full h-full bg-bg-raised flex items-center justify-center">
            <span className="text-text-muted text-2xl">{event.title}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-deep/90 via-bg-deep/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <p className="text-text-secondary text-sm mb-1" data-mono>
            {date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <h3 className="text-title text-text-primary">{event.title}</h3>
          {event.lineup && (
            <p className="text-text-secondary text-sm mt-1">
              {event.lineup.map((a) => a.name).join(" / ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
