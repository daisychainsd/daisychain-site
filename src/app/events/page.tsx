import Link from "next/link";
import { sanityFetch } from "@/sanity/client";

export const revalidate = 60;

import { eventFlyerUrl } from "@/lib/eventFlyerUrl";
import { EVENTS_LIST } from "@/lib/queries";
import type { Event } from "@/lib/types";
import EventsToggle from "@/components/EventsToggle";
import UpcomingEventCard from "@/components/UpcomingEventCard";
import SectionHeader from "@/components/SectionHeader";
import PastFlyerGrid from "@/components/PastFlyerGrid";

export default async function EventsPage() {
  const events = await sanityFetch<Event>(EVENTS_LIST);

  const now = new Date().toISOString();
  const upcoming = events.filter((e) => e.date >= now);
  const past = events.filter((e) => e.date < now);

  const pastFlyerTiles = past
    .filter((e) => e.flyer)
    .map((e) => ({
      slug: e.slug,
      imageUrl: eventFlyerUrl(e.flyer!, 1200),
      flyerVerticalAlign: e.flyerVerticalAlign,
    }));

  return (
    <div className="max-w-[1440px] mx-auto relative" style={{ padding: "clamp(40px, 5vw, 56px) clamp(24px, 4vw, 48px)" }}>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-9">
        <SectionHeader kicker="Live" title="Events" size="xl" as="h1" />
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
        <section id="upcoming" className="mb-20 scroll-mt-28">
          <div className="space-y-8">
            {upcoming.map((event) => (
              <UpcomingEventCard
                key={event.slug}
                title={event.title}
                date={event.date}
                venue={event.venue}
                flyerUrl={event.flyer ? eventFlyerUrl(event.flyer, 1600) : undefined}
                flyerVerticalAlign={event.flyerVerticalAlign}
                ticketUrl={event.ticketUrl}
              />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section id="past" className="scroll-mt-28">
          <SectionHeader kicker="Archive" title="Past Shows" />
          {pastFlyerTiles.length > 0 ? (
            <PastFlyerGrid tiles={pastFlyerTiles} />
          ) : (
            <p className="text-text-muted text-sm mt-4 max-w-md">
              Add flyer images in Sanity Studio on each past event to show them here.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
