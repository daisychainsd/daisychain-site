import type { Metadata } from "next";
import { client } from "@/sanity/client";
import { ABOUT_STATS } from "@/lib/queries";
import SectionHeader from "@/components/SectionHeader";

export const metadata: Metadata = {
  title: "About — Daisy Chain Records",
  description:
    "Daisy Chain Records is an independent electronic music label and intimate dance floor in San Diego, California, run by Player Dave.",
};

export const revalidate = 300;

interface AboutStats {
  releases: number;
  events: number;
  artists: number;
}

const CONTACTS: { label: string; email: string }[] = [
  { label: "Demos", email: "demos@daisychainsd.com" },
  { label: "Press", email: "press@daisychainsd.com" },
  { label: "Bookings", email: "book@daisychainsd.com" },
  { label: "General", email: "hi@daisychainsd.com" },
];

export default async function AboutPage() {
  const stats: AboutStats = (client ? await client.fetch(ABOUT_STATS) : null) ?? {
    releases: 0,
    events: 0,
    artists: 0,
  };

  return (
    <div className="max-w-[1440px] mx-auto" style={{ padding: "clamp(40px, 5vw, 56px) clamp(24px, 4vw, 48px)" }}>
      <SectionHeader kicker="About" title="Daisy Chain" size="xl" as="h1" />

      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-10 md:gap-16 items-start">
        <div>
          <p
            className="uppercase text-text-primary m-0 mb-7"
            style={{
              fontFamily: "var(--font-heading), system-ui, sans-serif",
              fontWeight: 900,
              fontSize: "clamp(2rem, 3.5vw, 3.25rem)",
              letterSpacing: "-0.02em",
              lineHeight: 1.02,
            }}
          >
            A label and an intimate dance floor in San Diego, California.
          </p>
          <p className="text-text-secondary text-[17px] leading-[1.65] m-0 mb-4 max-w-[640px]">
            Daisy Chain started in 2021 as a party, then a record. It&apos;s run by Player Dave
            out of Spin Nightclub. We release music from a small family of artists and throw
            shows for the city.
          </p>
          <p className="text-text-secondary text-[17px] leading-[1.65] m-0 max-w-[640px]">
            We care about the floor more than the algorithm. Our sets are long, our rooms are
            small, and our flyers are loud. The records come out when they&apos;re ready.
          </p>
        </div>

        <div
          className="flex flex-col overflow-hidden"
          style={{
            borderRadius: "var(--radius-organic-md)",
            background: "var(--color-bg-surface)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <StatRow k="Est." v="2021" />
          <StatRow k="Releases" v={String(stats.releases)} />
          <StatRow k="Parties" v={String(stats.events)} />
          <StatRow k="Artists" v={String(stats.artists)} />
          <StatRow k="Home" v="Spin NC" />
          <StatRow k="City" v="San Diego" last />
        </div>
      </div>

      <div className="mt-20">
        <SectionHeader kicker="Contact" title="Say Hi" />
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}
        >
          {CONTACTS.map(({ label, email }) => (
            <div
              key={label}
              className="p-5"
              style={{
                borderRadius: "var(--radius-organic-md)",
                background: "var(--color-bg-surface)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                className="uppercase text-text-muted mb-2"
                style={{
                  fontFamily: "var(--font-heading), system-ui, sans-serif",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                }}
              >
                {label}
              </div>
              <a
                href={`mailto:${email}`}
                className="text-blue-300 hover:text-blue-200 transition-colors underline underline-offset-4 break-all"
                style={{ fontFamily: "var(--font-mono), monospace", fontSize: 15 }}
              >
                {email}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatRow({ k, v, last = false }: { k: string; v: string; last?: boolean }) {
  return (
    <div
      className="flex justify-between items-baseline"
      style={{
        padding: "16px 20px",
        borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <span
        className="uppercase text-text-muted"
        style={{
          fontFamily: "var(--font-heading), system-ui, sans-serif",
          fontSize: 11,
          letterSpacing: "0.08em",
        }}
      >
        {k}
      </span>
      <span
        className="uppercase text-text-primary"
        style={{
          fontFamily: "var(--font-heading), system-ui, sans-serif",
          fontWeight: 900,
          fontSize: 20,
          letterSpacing: "-0.01em",
        }}
      >
        {v}
      </span>
    </div>
  );
}
