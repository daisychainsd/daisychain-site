import Link from "next/link";
import { sanityFetch } from "@/sanity/client";

export const revalidate = 60;

import { urlFor } from "@/sanity/image";
import { EVENTS_LIST } from "@/lib/queries";
import type { Event } from "@/lib/types";
import { fmtEventDate } from "@/lib/dates";
import EventsToggle from "@/components/EventsToggle";
import UpcomingEventCard from "@/components/UpcomingEventCard";
import SectionHeader from "@/components/SectionHeader";

export default async function EventsPage() {
  const events = await sanityFetch<Event>(EVENTS_LIST);

  const now = new Date().toISOString();
  const upcoming = events.filter((e) => e.date >= now);
  const past = events.filter((e) => e.date < now);

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
                flyerUrl={event.flyer ? urlFor(event.flyer).width(800).url() : undefined}
                ticketUrl={event.ticketUrl}
              />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section id="past" className="scroll-mt-28">
          <SectionHeader kicker="Archive" title="Past Shows" />
          <PastShowsList events={past} />
        </section>
      )}
    </div>
  );
}

function PastShowsList({ events }: { events: Event[] }) {
  // Event numbers: newest past show = highest number. Use the EVENTS_LIST order (desc by date).
  // The DC event title typically already contains "Daisy Chain #N"; if not, fall back to position.
  return (
    <div className="flex flex-col" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      {events.map((event, i) => {
        const dateStr = fmtEventDate(event.date, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        }).toUpperCase();

        // Pull "#NN" out of the title if present, else use position
        const numMatch = event.title.match(/#\s*(\d+)/);
        const num = numMatch ? numMatch[1].padStart(2, "0") : String(events.length - i).padStart(2, "0");
        const displayTitle = event.title.replace(/\s*Daisy Chain\s*/i, "").trim() || event.title;
        const headliner = event.lineup?.[0]?.name;

        return (
          <div
            key={event.slug}
            className="grid items-center gap-4 transition-colors"
            style={{
              gridTemplateColumns: "minmax(48px, 60px) minmax(120px, 160px) minmax(0, 2fr) minmax(0, 1.4fr) minmax(0, 1fr) auto",
              padding: "22px 8px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <span
              className="text-blue-300"
              style={{ fontFamily: "var(--font-mono), monospace", fontSize: 13 }}
            >
              #{num}
            </span>
            <span
              className="text-text-muted"
              style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, letterSpacing: "0.04em" }}
            >
              {dateStr}
            </span>
            <span
              className="uppercase text-text-primary truncate"
              style={{
                fontFamily: "var(--font-heading), system-ui, sans-serif",
                fontWeight: 900,
                fontSize: 20,
                letterSpacing: "-0.01em",
              }}
            >
              {displayTitle}
            </span>
            <span className="text-text-secondary text-sm truncate">
              {headliner ? `w/ ${headliner}` : ""}
            </span>
            <span
              className="text-text-muted truncate"
              style={{ fontFamily: "var(--font-mono), monospace", fontSize: 13 }}
            >
              {event.venue || ""}
            </span>
            <div className="flex justify-end">
              {event.recapUrl ? (
                <a
                  href={event.recapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="uppercase text-blue-300 hover:text-blue-200 transition-colors whitespace-nowrap"
                  style={{
                    fontFamily: "var(--font-heading), system-ui, sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: "0.06em",
                  }}
                >
                  View recap →
                </a>
              ) : (
                <span className="text-text-faint text-xs select-none whitespace-nowrap">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
