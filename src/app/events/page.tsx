import { sanityFetch } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import { EVENTS_LIST } from "@/lib/queries";
import type { Event } from "@/lib/types";

export default async function EventsPage() {
  const events = await sanityFetch<Event>(EVENTS_LIST);

  const now = new Date().toISOString();
  const upcoming = events.filter((e) => e.date >= now);
  const past = events.filter((e) => e.date < now);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 relative">
      {/* Decorative blob — lavender tint for events */}
      <div className="blob w-[400px] h-[400px] bg-lavender-300 top-[-100px] right-[-150px] animate-drift" />

      <div className="mb-10">
        <p className="text-label mb-2">Live</p>
        <h1 className="text-headline text-text-primary">Events</h1>
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
        <section className="mb-16">
          <span className="container-pill-l inline-block px-4 py-1.5 text-xs uppercase tracking-wider text-amber-300 border border-amber-300/20 bg-amber-300/5 mb-6" data-mono>
            Upcoming
          </span>
          <div className="space-y-6">
            {upcoming.map((event) => (
              <EventCard key={event.slug} event={event} isUpcoming />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <div className="divider-glow mb-8" />
          <p className="text-label mb-6">Past Events</p>
          <div className="space-y-6 opacity-60">
            {past.map((event) => (
              <EventCard key={event.slug} event={event} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EventCard({ event, isUpcoming }: { event: Event; isUpcoming?: boolean }) {
  const date = new Date(event.date);
  return (
    <div className="container-organic p-3 flex gap-5 items-start">
      {event.flyer && (
        <div className="container-inset w-32 h-32 relative shrink-0">
          <img
            src={urlFor(event.flyer).width(300).url()}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="py-1">
        <p className={`text-sm ${isUpcoming ? "text-amber-300" : "text-text-secondary"}`}>
          {date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        <h3 className="text-title mt-1">{event.title}</h3>
        {event.venue && <p className="text-text-secondary text-sm">{event.venue}</p>}
        {event.lineup && (
          <p className="text-text-secondary text-sm mt-2">
            {event.lineup.map((a) => a.name).join(" / ")}
          </p>
        )}
        {event.ticketUrl && (
          <a
            href={event.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`container-pill-r inline-flex items-center gap-2 mt-3 text-sm font-medium px-5 py-1.5 transition-all ${
              isUpcoming
                ? "bg-amber-300 text-bg-deep hover:bg-amber-400"
                : "text-blue-300 border border-blue-300/30 hover:bg-blue-300/10"
            }`}
          >
            Tickets
          </a>
        )}
      </div>
    </div>
  );
}
