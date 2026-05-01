import Link from "next/link";
import { eventFlyerUrl, flyerObjectPosition } from "@/lib/eventFlyerUrl";
import type { Event } from "@/lib/types";
import { DC_TIMEZONE } from "@/lib/dates";

function formatTicketDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    timeZone: DC_TIMEZONE,
    month: "short",
    day: "numeric",
  });
}

function formatTicketDateTimeLine(d: Date) {
  return formatTicketDate(d).toUpperCase();
}

export default function EventTicketCard({ event }: { event: Event }) {
  const eventDate = new Date(event.date);
  const flyerUrl = event.flyer ? eventFlyerUrl(event.flyer, 1400) : null;
  const headline =
    event.lineup && event.lineup.length > 0 ? event.lineup[0].name : "Daisy Chain";

  return (
    <div className="relative mx-auto max-w-md px-2 pb-2 pt-4 sm:px-0">
      <div
        className="pointer-events-none absolute left-1/2 top-4 z-10 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-300/15 bg-bg-deep shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        aria-hidden
      />

      <article
        className="relative overflow-hidden rounded-2xl border border-blue-300/20 bg-bg-surface/95 pt-4 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-sm"
        style={{ scrollMarginTop: "6rem" }}
        id={event.slug}
      >
        <div className="px-4 pb-0 pt-0 sm:px-5">
          <p className="font-[family-name:var(--font-mono)] text-[0.7rem] font-medium tabular-nums uppercase text-text-primary sm:text-xs">
            {formatTicketDateTimeLine(eventDate)}
          </p>

          <div className="my-2 border-t border-dashed border-blue-300/25" aria-hidden />

          <p
            className="font-[family-name:var(--font-label)] text-[0.6rem] font-bold uppercase tracking-[0.18em] text-amber-300/90"
            data-label
          >
            {headline}
          </p>
          <h2 className="mt-0.5 font-[family-name:var(--font-heading)] text-xl font-black uppercase leading-tight tracking-tight text-text-primary sm:text-2xl">
            {event.title}
          </h2>
          {event.venue ? (
            <p className="mt-1 text-xs text-text-muted sm:text-sm">{event.venue}</p>
          ) : null}
        </div>

        {flyerUrl && (
          <div className="mt-3 px-4 sm:px-5">
            <div className="overflow-hidden rounded-lg border border-blue-300/15 bg-bg-deep/50">
              <img
                src={flyerUrl}
                alt=""
                className="h-32 w-full object-cover sm:h-40"
                style={{ objectPosition: flyerObjectPosition(event.flyerVerticalAlign) }}
                loading="lazy"
              />
            </div>
          </div>
        )}

        {event.lineup && event.lineup.length > 0 && (
          <div className="mt-3 px-4 pb-1 sm:px-5">
            <p
              className="font-[family-name:var(--font-label)] text-[0.6rem] font-bold uppercase tracking-[0.18em] text-text-muted"
              data-label
            >
              Lineup
            </p>
            <ul className="mt-1 space-y-1 text-xs text-text-secondary sm:text-sm">
              {event.lineup.map((entry, i) =>
                entry.artistSlug ? (
                  <li key={i}>
                    <Link
                      href={`/artists/${entry.artistSlug}`}
                      className="text-amber-300 transition-colors hover:text-amber-200"
                    >
                      {entry.name}
                    </Link>
                  </li>
                ) : (
                  <li key={i}>{entry.name}</li>
                ),
              )}
            </ul>
          </div>
        )}

        <div className="border-t border-blue-300/15 bg-bg-deep/40 px-4 py-3 sm:px-5 sm:py-4">
          {event.ticketUrl ? (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center rounded-full bg-amber-300 px-5 py-2.5 font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-wider text-bg-deep transition-[filter] duration-(--default-transition-duration) ease-(--default-transition-timing-function) hover:brightness-110 sm:text-sm"
            >
              Get tickets
            </a>
          ) : (
            <p className="text-center text-xs text-text-muted sm:text-sm">Tickets TBA</p>
          )}
          <p
            className="mt-2 text-center font-[family-name:var(--font-mono)] text-[0.55rem] uppercase tracking-[0.3em] text-text-muted/70 sm:mt-2.5 sm:text-[0.6rem]"
            data-label
          >
            Admit one · Daisy Chain
          </p>
        </div>
      </article>

      <div
        className="pointer-events-none absolute bottom-2 left-1/2 z-10 size-6 -translate-x-1/2 translate-y-1/2 rounded-full border border-blue-300/15 bg-bg-deep shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        aria-hidden
      />
    </div>
  );
}
