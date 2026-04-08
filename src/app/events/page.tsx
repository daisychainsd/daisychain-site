import Link from "next/link";
import { sanityFetch } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import { EVENTS_LIST } from "@/lib/queries";
import type { Event } from "@/lib/types";
import EventsToggle from "@/components/EventsToggle";
import UpcomingEventCard from "@/components/UpcomingEventCard";

export default async function EventsPage() {
  const events = await sanityFetch<Event>(EVENTS_LIST);

  const now = new Date().toISOString();
  const upcoming = events.filter((e) => e.date >= now);
  const past = events.filter((e) => e.date < now);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 relative overflow-hidden">
      <div className="blob w-[400px] h-[400px] bg-lavender-300 top-[-100px] right-[-150px] animate-drift" />

      <div className="flex items-end justify-between mb-10 gap-4 flex-wrap">
        <div>
          <p className="text-label mb-2">Live</p>
          <h1 className="text-headline text-text-primary">Events</h1>
        </div>
        {upcoming.length > 0 && past.length > 0 && (
          <EventsToggle upcomingCount={upcoming.length} pastCount={past.length} />
        )}
      </div>

      {events.length === 0 && (
        <p className="text-text-muted text-center py-20">
          No events yet — add them at{" "}
          <Link href="/studio" className="text-blue-300 hover:underline">
            /studio
          </Link>
        </p>
      )}

      {upcoming.length > 0 && (
        <section id="upcoming" className="mb-16 scroll-mt-28">
          <div className="space-y-8">
            {upcoming.map((event) => (
              <UpcomingEventCard
                key={event.slug}
                title={event.title}
                date={event.date}
                venue={event.venue}
                flyerUrl={event.flyer ? urlFor(event.flyer).width(800).url() : undefined}
                ticketUrl={event.ticketUrl}
                lineup={event.lineup}
              />
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

function PastCard({ event }: { event: Event }) {
  const date = new Date(event.date);

  return (
    <div className="container-organic overflow-hidden group hover-lift">
      <div className="relative aspect-[4/5]">
        {event.flyer ? (
          <img
            src={urlFor(event.flyer).width(600).url()}
            alt={event.title}
            className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity ease-in-out"
          />
        ) : (
          <div className="w-full h-full bg-bg-raised flex items-center justify-center">
            <span className="text-text-muted text-2xl">{event.title}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-deep/90 via-bg-deep/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <p className="text-text-secondary text-sm mb-1" data-label>
            {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
