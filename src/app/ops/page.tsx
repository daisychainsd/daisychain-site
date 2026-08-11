import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  runHealthChecks,
  get30DayRevenue,
  type HealthCheck,
} from "@/lib/ops-health";
import { client as sanityClient, sanityFetch } from "@/sanity/client";
import { DC_TIMEZONE } from "@/lib/dates";
import { getSopAreas, sopCounts, type SopStatus } from "@/lib/sops";
import { getLatestAuditResult, type AuditFinding } from "@/lib/catalog-audit";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ops",
  robots: { index: false, follow: false },
};

const GREEN = "#5FBF77";
const RED = "#E85C5C";

const UPCOMING_EVENTS_QUERY = `
  *[_type == "event" && hidden != true && date >= now()] | order(date asc)[0...12] {
    title,
    date,
    venue
  }`;

const UPCOMING_RELEASES_QUERY = `
  *[_type == "release" && hidden != true && status == "upcoming"]
    | order(coalesce(goLiveAt, releaseDate) asc)[0...12] {
    title,
    "artist": coalesce(artists[0]->name, displayArtist, artist->name),
    catalogNumber,
    releaseDate,
    goLiveAt
  }`;

type UpcomingEvent = { title: string; date?: string; venue?: string };
type UpcomingRelease = {
  title: string;
  artist?: string;
  catalogNumber?: string;
  releaseDate?: string;
  goLiveAt?: string;
};
type UpcomingItem = {
  kind: "show" | "release";
  title: string;
  sub: string;
  when: Date | null;
};

function fmtDate(d: Date | null, withTime = false): string {
  if (!d || isNaN(d.getTime())) return "TBA";
  return d.toLocaleDateString("en-US", {
    timeZone: DC_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

function fmtMoney(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`container-organic p-6 ${className}`}>
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <h2
          className="uppercase m-0 text-text-primary"
          style={{
            fontFamily: "var(--font-heading), system-ui, sans-serif",
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: "0.08em",
          }}
        >
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-label={ok ? "healthy" : "failing"}
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{
        background: ok ? GREEN : RED,
        boxShadow: `0 0 8px ${ok ? "rgba(95,191,119,0.5)" : "rgba(232,92,92,0.5)"}`,
      }}
    />
  );
}

function HealthTile({ check }: { check: HealthCheck }) {
  return (
    <div className="container-inset-md p-4 min-w-0">
      <div className="flex items-center gap-2.5 mb-2">
        <StatusDot ok={check.ok} />
        <span
          className="uppercase text-text-primary truncate"
          style={{
            fontFamily: "var(--font-heading), system-ui, sans-serif",
            fontSize: 11,
            letterSpacing: "0.08em",
          }}
        >
          {check.name}
        </span>
      </div>
      <div
        className="break-words"
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 12,
          color: check.ok ? "var(--color-text-secondary)" : RED,
          lineHeight: 1.5,
        }}
      >
        {check.detail}
      </div>
      <div
        className="mt-1"
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 11,
          color: "var(--color-text-muted)",
        }}
      >
        {check.ms}ms
      </div>
    </div>
  );
}

const SOP_STATUS_STYLE: Record<
  SopStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  live: {
    label: "Live",
    color: GREEN,
    bg: "rgba(95,191,119,0.12)",
    border: "rgba(95,191,119,0.25)",
  },
  draft: {
    label: "Draft",
    color: "var(--color-blue-300, #7CB9E8)",
    bg: "rgba(124,185,232,0.12)",
    border: "rgba(124,185,232,0.25)",
  },
  todo: {
    label: "To build",
    color: "var(--color-text-muted)",
    bg: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.12)",
  },
};

function SopStatusPill({ status }: { status: SopStatus }) {
  const s = SOP_STATUS_STYLE[status];
  return (
    <span
      className="uppercase shrink-0 rounded-full px-2.5 py-0.5"
      style={{
        fontFamily: "var(--font-heading), system-ui, sans-serif",
        fontSize: 9,
        letterSpacing: "0.1em",
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
        minWidth: 64,
        textAlign: "center",
      }}
    >
      {s.label}
    </span>
  );
}

function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-t border-white/[0.06] first:border-t-0 min-w-0">
      <span
        className="uppercase shrink-0"
        style={{
          fontFamily: "var(--font-heading), system-ui, sans-serif",
          fontSize: 10,
          letterSpacing: "0.1em",
          color: "var(--color-text-muted)",
        }}
      >
        {label}
      </span>
      <span
        className="text-right break-all"
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 13,
          color: "var(--color-text-primary)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

const AUDIT_KIND_STYLE: Record<
  AuditFinding["kind"],
  { label: string; color: string }
> = {
  broken: { label: "Broken", color: RED },
  unverifiable: { label: "Unverifiable", color: "#E8C95C" },
  missing: { label: "Known gaps", color: "var(--color-text-muted)" },
};

function AuditFindingsGroup({
  kind,
  findings,
}: {
  kind: AuditFinding["kind"];
  findings: AuditFinding[];
}) {
  const rows = findings.filter((f) => f.kind === kind);
  if (rows.length === 0) return null;
  const s = AUDIT_KIND_STYLE[kind];
  return (
    <div className="mt-3">
      <div
        className="uppercase mb-1"
        style={{
          fontFamily: "var(--font-heading), system-ui, sans-serif",
          fontSize: 10,
          letterSpacing: "0.1em",
          color: s.color,
        }}
      >
        {s.label} · {rows.length}
      </div>
      <ul className="m-0 p-0 list-none">
        {rows.map((f, i) => (
          <li
            key={i}
            className="flex flex-wrap items-baseline gap-x-3 py-1.5 border-t border-white/[0.06] first:border-t-0"
          >
            <span className="text-text-primary text-sm shrink-0">{f.where}</span>
            <span
              className="min-w-0 flex-1 break-words"
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 11,
                color: kind === "broken" ? RED : "var(--color-text-secondary)",
              }}
            >
              {f.what}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function OpsPage() {
  const [health, revenue, events, releases, sopAreas, audit] = await Promise.all([
    runHealthChecks(),
    get30DayRevenue(),
    sanityFetch<UpcomingEvent>(UPCOMING_EVENTS_QUERY),
    sanityFetch<UpcomingRelease>(UPCOMING_RELEASES_QUERY),
    getSopAreas(),
    getLatestAuditResult(),
  ]);

  const failingChecks = health.checks.filter((c) => !c.ok).length;
  const brokenAudit = audit?.findings.filter((f) => f.kind === "broken").length ?? 0;
  const failingCount = failingChecks + brokenAudit;

  const upcoming: UpcomingItem[] = [
    ...events.map((e): UpcomingItem => {
      const when = e.date ? new Date(e.date) : null;
      return { kind: "show", title: e.title, sub: e.venue ?? "", when };
    }),
    ...releases.map((r): UpcomingItem => {
      const raw = r.goLiveAt ?? (r.releaseDate ? `${r.releaseDate}T12:00:00` : null);
      const when = raw ? new Date(raw) : null;
      const sub = [r.artist, r.catalogNumber].filter(Boolean).join(" · ");
      return { kind: "release", title: r.title, sub, when };
    }),
  ].sort(
    (a, b) => (a.when?.getTime() ?? Infinity) - (b.when?.getTime() ?? Infinity)
  );

  const email = health.email;
  const laylo = email?.laylo;
  const cursors = email?.cursors;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Self-refresh every 2 minutes — meta refresh is honored in body by all major browsers. */}
      <meta httpEquiv="refresh" content="120" />

      <div className="flex flex-wrap items-end justify-between gap-4 mb-9">
        <div>
          <div
            className="text-blue-300 uppercase mb-2.5"
            style={{
              fontFamily: "var(--font-heading), system-ui, sans-serif",
              fontSize: 11,
              letterSpacing: "0.12em",
            }}
          >
            — Internal
          </div>
          <h1
            className="uppercase text-text-primary m-0"
            style={{
              fontFamily: "var(--font-heading), system-ui, sans-serif",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 0.92,
              fontSize: "clamp(2.25rem, 4.5vw, 4rem)",
            }}
          >
            Ops
          </h1>
        </div>
        <div className="flex items-center gap-2.5 pb-1">
          <StatusDot ok={failingCount === 0} />
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 12,
              color: "var(--color-text-secondary)",
            }}
          >
            {failingCount === 0
              ? "all systems green"
              : `${failingCount} issue${failingCount === 1 ? "" : "s"}`}
            {" · checked "}
            {new Date(health.checkedAt).toLocaleTimeString("en-US", {
              timeZone: DC_TIMEZONE,
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            PT
          </span>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Health: collapsed behind a green bar when everything is fine; the bar
            turns red and the section auto-expands when anything is failing. */}
        <details className="container-organic group overflow-hidden" open={failingCount > 0}>
          <summary
            className="flex flex-wrap items-center gap-3 p-6 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden rounded-[inherit]"
            style={{
              background:
                failingCount === 0 ? "rgba(95,191,119,0.08)" : "rgba(232,92,92,0.08)",
            }}
          >
            <StatusDot ok={failingCount === 0} />
            <h2
              className="uppercase m-0 text-text-primary"
              style={{
                fontFamily: "var(--font-heading), system-ui, sans-serif",
                fontWeight: 900,
                fontSize: 14,
                letterSpacing: "0.08em",
              }}
            >
              Health
            </h2>
            <span
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 12,
                color: failingCount === 0 ? GREEN : RED,
              }}
            >
              {failingCount === 0
                ? "all clear"
                : [
                    failingChecks > 0 ? `${failingChecks} system${failingChecks === 1 ? "" : "s"} failing` : null,
                    brokenAudit > 0 ? `${brokenAudit} broken in catalog` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </span>
            <svg
              aria-hidden
              className="ml-auto shrink-0 transition-[transform] group-open:rotate-180"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--color-text-muted)" }}
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </summary>

          <div className="p-6 pt-4">
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
            >
              {health.checks.map((check) => (
                <HealthTile key={check.name} check={check} />
              ))}
            </div>

            <div className="mt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3 mb-1">
                <span
                  className="uppercase text-text-primary"
                  style={{
                    fontFamily: "var(--font-heading), system-ui, sans-serif",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                  }}
                >
                  Catalog audit
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 11,
                    color: "var(--color-text-muted)",
                  }}
                >
                  {audit
                    ? `last run ${fmtDate(new Date(audit.checkedAt))} · ${audit.counts.releases} releases · ${audit.counts.dspLinks} links · ${audit.counts.files} files`
                    : "no run yet — Mondays 7am PT"}
                </span>
              </div>
              {audit && audit.findings.length === 0 && (
                <p className="text-sm m-0" style={{ color: GREEN }}>
                  Nothing broken, nothing missing.
                </p>
              )}
              {audit && (
                <>
                  <AuditFindingsGroup kind="broken" findings={audit.findings} />
                  <AuditFindingsGroup kind="unverifiable" findings={audit.findings} />
                  <AuditFindingsGroup kind="missing" findings={audit.findings} />
                </>
              )}
            </div>
          </div>
        </details>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel
            title="Orders"
            right={
              <span
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 13,
                  color: "var(--color-text-secondary)",
                }}
              >
                30d:{" "}
                <span className="text-blue-300">
                  {revenue
                    ? `${fmtMoney(revenue.totalCents)}${revenue.capped ? " (100+ charges)" : ""}`
                    : "—"}
                </span>
              </span>
            }
          >
            {health.orders.length === 0 ? (
              <p className="text-text-muted text-sm m-0">
                No order data — Stripe unreachable or no checkouts yet.
              </p>
            ) : (
              <ul className="m-0 p-0 list-none">
                {health.orders.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-2.5 border-t border-white/[0.06] first:border-t-0"
                  >
                    <span
                      className="shrink-0"
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: 12,
                        color: "var(--color-text-muted)",
                        minWidth: 88,
                      }}
                    >
                      {fmtDate(new Date(c.created * 1000))}
                    </span>
                    <span
                      className="shrink-0 text-blue-300"
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: 13,
                        minWidth: 64,
                      }}
                    >
                      {fmtMoney(c.amountCents, c.currency)}
                    </span>
                    <span className="text-text-primary text-sm min-w-0 flex-1 truncate">
                      {c.description ?? "—"}
                    </span>
                    <span
                      className="min-w-0 truncate"
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: 12,
                        color: "var(--color-text-secondary)",
                        maxWidth: "16rem",
                      }}
                    >
                      {c.email ?? "no email"}
                    </span>
                    {c.status !== "paid" && (
                      <span
                        className="uppercase shrink-0"
                        style={{
                          fontFamily: "var(--font-mono), monospace",
                          fontSize: 11,
                          color: RED,
                        }}
                      >
                        {c.status}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Email">
            {!email ? (
              <p className="text-text-muted text-sm m-0">
                dc-email-api unreachable — no email stats.
              </p>
            ) : (
              <div>
                <StatRow
                  label="Subscribers"
                  value={
                    typeof email.beehiiv?.subscriberCount === "number" ? (
                      <span className="text-blue-300" style={{ fontSize: 18 }}>
                        {email.beehiiv.subscriberCount.toLocaleString("en-US")}
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                <StatRow
                  label="Last post"
                  value={
                    email.beehiiv?.lastPost
                      ? `${email.beehiiv.lastPost.title} · ${fmtDate(new Date(email.beehiiv.lastPost.publishedAt))}`
                      : "—"
                  }
                />
                <StatRow
                  label="Bandcamp cursor"
                  value={cursors?.bandcampLastEndTime ?? "—"}
                />
                <StatRow
                  label="Shotgun cursor"
                  value={cursors?.shotgunLastAfter ?? "—"}
                />
                <StatRow
                  label="Laylo webhook"
                  value={
                    typeof laylo?.daysSince === "number"
                      ? laylo.daysSince === 0
                        ? "today"
                        : `${laylo.daysSince}d ago`
                      : "never seen"
                  }
                />
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Upcoming">
          {!sanityClient ? (
            <p className="text-text-muted text-sm m-0">Sanity not connected yet.</p>
          ) : upcoming.length === 0 ? (
            <p className="text-text-muted text-sm m-0">
              Nothing on the calendar — no upcoming shows or releases in Sanity.
            </p>
          ) : (
            <ul className="m-0 p-0 list-none">
              {upcoming.map((item, i) => (
                <li
                  key={`${item.kind}-${item.title}-${i}`}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-2.5 border-t border-white/[0.06] first:border-t-0"
                >
                  <span
                    className="shrink-0"
                    style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: 12,
                      color: "var(--color-text-muted)",
                      minWidth: 110,
                    }}
                  >
                    {fmtDate(item.when, item.kind === "show")}
                  </span>
                  <span
                    className="uppercase shrink-0 rounded-full px-2.5 py-0.5"
                    style={{
                      fontFamily: "var(--font-heading), system-ui, sans-serif",
                      fontSize: 9,
                      letterSpacing: "0.1em",
                      color: "var(--color-blue-300, #7CB9E8)",
                      background: "rgba(124,185,232,0.12)",
                      border: "1px solid rgba(124,185,232,0.25)",
                      minWidth: 72,
                      textAlign: "center",
                    }}
                  >
                    {item.kind}
                  </span>
                  <span className="text-text-primary text-sm min-w-0 flex-1 truncate">
                    {item.title}
                  </span>
                  {item.sub && (
                    <span
                      className="min-w-0 truncate"
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: 12,
                        color: "var(--color-text-secondary)",
                        maxWidth: "18rem",
                      }}
                    >
                      {item.sub}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="SOPs"
          right={
            <span
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 12,
                color: "var(--color-text-secondary)",
              }}
            >
              {(() => {
                const c = sopCounts(sopAreas);
                return (
                  <>
                    <span style={{ color: GREEN }}>{c.live} live</span>
                    {" · "}
                    <span className="text-blue-300">{c.draft} draft</span>
                    {" · "}
                    {c.todo} to build
                  </>
                );
              })()}
            </span>
          }
        >
          <div className="grid gap-5">
            {sopAreas.map((area) => (
              <div key={area.area}>
                <div
                  className="uppercase mb-1"
                  style={{
                    fontFamily: "var(--font-heading), system-ui, sans-serif",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {area.area}
                </div>
                <ul className="m-0 p-0 list-none">
                  {area.sops.map((sop) => (
                    <li
                      key={sop.name}
                      className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-2.5 border-t border-white/[0.06] first:border-t-0"
                    >
                      <SopStatusPill status={sop.status} />
                      <span className="text-text-primary text-sm shrink-0">
                        {sop.name}
                      </span>
                      <span
                        className="shrink-0"
                        style={{
                          fontFamily: "var(--font-mono), monospace",
                          fontSize: 11,
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {sop.owner}
                      </span>
                      {sop.note && (
                        <span
                          className="min-w-0 flex-1 truncate"
                          style={{
                            fontFamily: "var(--font-mono), monospace",
                            fontSize: 11,
                            color: "var(--color-text-muted)",
                          }}
                        >
                          {sop.note}
                        </span>
                      )}
                      {sop.slug && sop.docId && (
                        <a
                          href={`/ops/sops/${sop.slug}`}
                          className="shrink-0 text-blue-300 hover:underline"
                          style={{
                            fontFamily: "var(--font-mono), monospace",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          View SOP →
                        </a>
                      )}
                      {sop.links?.map((link) => (
                        <a
                          key={link.href + link.label}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-blue-300 hover:underline"
                          style={{
                            fontFamily: "var(--font-mono), monospace",
                            fontSize: 11,
                          }}
                        >
                          {link.label} →
                        </a>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
