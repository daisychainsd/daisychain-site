import type { Metadata } from "next";
import SectionHeader from "@/components/SectionHeader";

export const metadata: Metadata = {
  title: "About — Daisy Chain Records",
  description:
    "Daisy Chain Records is an independent electronic music label and intimate dance floor in San Diego, California, run by Player Dave.",
};

export const revalidate = 300;

const CONTACTS: { label: string; email: string }[] = [
  { label: "Support", email: "admin@daisychainsd.com" },
  { label: "Label Inquiries", email: "niko@daisychainsd.com" },
];

export default async function AboutPage() {
  return (
    <div className="max-w-[1440px] mx-auto" style={{ padding: "clamp(40px, 5vw, 56px) clamp(24px, 4vw, 48px)" }}>
      <SectionHeader kicker="About" title="Daisy Chain" size="xl" as="h1" />

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

      <div className="mt-20">
        <SectionHeader kicker="Contact" title="Contact" />
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
