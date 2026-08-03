// SOP registry for the /ops dashboard.
// Source of truth for framework content: ~/Projects/daisychain-ops/OPERATIONS-MAP.md
// Edit this file to add/promote SOPs — status flow is todo → draft → live.

export type SopStatus = "live" | "draft" | "todo";

export type SopLink = { label: string; href: string };

export type Sop = {
  name: string;
  status: SopStatus;
  owner: string;
  note?: string;
  links?: SopLink[];
  /** URL slug for the /ops/sops/[slug] viewer page. Required when docId is set. */
  slug?: string;
  /** Google Doc ID — the editable SOP document, embedded on the viewer page. */
  docId?: string;
};

export type SopArea = { area: string; sops: Sop[] };

const RELEASE_CHECKLIST_SHEET =
  "https://docs.google.com/spreadsheets/d/1-1U8Ovpz8to7gjjLVYYpcwNrt3ZAPbqJRzlSWADhTfs/edit";
const RELEASE_ROLLOUT_ASANA =
  "https://app.asana.com/1/1202074484822228/project/1217081243414977";
const SOCIAL_CAL_SHEET =
  "https://docs.google.com/spreadsheets/d/1q-0kTWdbu1i76CaudLutT_cTQ2LbG-CAzD7eF9zN85M/edit";

export const SOP_AREAS: SopArea[] = [
  {
    area: "Label",
    sops: [
      {
        name: "Pre-Signing / A&R",
        status: "todo",
        owner: "PD decides, Niko runs",
        note: "13 steps in checklist sheet — needs owners + A&R pipeline tracker",
        links: [{ label: "Checklist sheet", href: RELEASE_CHECKLIST_SHEET }],
      },
      {
        name: "Pre-Release Rollout",
        status: "draft",
        owner: "Niko runs, PD gates",
        note: "24 steps, 6 phases — 4 open items left to resolve",
        slug: "label-release-rollout",
        docId: "1XbBwUeDOqk4ubYUW8QjT8fEXt4q-NSzt9km7F6esb3c",
        links: [
          { label: "Asana template", href: RELEASE_ROLLOUT_ASANA },
          { label: "Checklist sheet", href: RELEASE_CHECKLIST_SHEET },
        ],
      },
      {
        name: "Release Day",
        status: "todo",
        owner: "Niko",
        note: "7 steps in checklist sheet — needs owners",
        links: [{ label: "Checklist sheet", href: RELEASE_CHECKLIST_SHEET }],
      },
      {
        name: "Post-Release (weeks 1-4)",
        status: "todo",
        owner: "Niko",
        note: "Design from scratch — follow-up push + artist recap report",
      },
    ],
  },
  {
    area: "Site / Store / Data",
    sops: [
      {
        name: "Automated daily health checks",
        status: "live",
        owner: "Cron + this dashboard",
        note: "Extend to download delivery + merch checkout edge cases",
      },
      {
        name: "Catalog / link / download audit bot",
        status: "todo",
        owner: "Automation",
        note: "Crawl release pages, verify DSP links + downloads — #1 automation priority",
      },
      {
        name: "Weekly human review ritual",
        status: "todo",
        owner: "PD",
        note: "15-min weekly pass over dashboard + audit report",
      },
      {
        name: "Artist data source of truth",
        status: "todo",
        owner: "PD + Niko",
        note: "Data scattered — pick home, migrate, then audit bot maintains",
      },
      {
        name: "Money consolidation into Parcel",
        status: "todo",
        owner: "PD",
        note: "One-time setup, then monthly reconcile ritual",
      },
    ],
  },
  {
    area: "Marketing / Content",
    sops: [
      {
        name: "Content pillars + mix ratio",
        status: "todo",
        owner: "PD, then social hire",
        note: "Raw material exists in checklist sheet branding tab",
        links: [{ label: "Checklist sheet", href: RELEASE_CHECKLIST_SHEET }],
      },
      {
        name: "Weekly content calendar workflow",
        status: "draft",
        owner: "PD, then social hire",
        note: "Social cal sheet + calendar sync live — needs the weekly ritual",
        links: [{ label: "Social cal sheet", href: SOCIAL_CAL_SHEET }],
      },
      {
        name: "Caption builder Discord bot",
        status: "todo",
        owner: "Automation",
        note: "Build after content pillars are defined",
      },
    ],
  },
  {
    area: "Email / SMS",
    sops: [
      {
        name: "Monthly send calendar",
        status: "todo",
        owner: "PD",
        note: "beehiiv + Laylo currently moment-only — add deliberate rhythm",
      },
      {
        name: "Source segmentation",
        status: "todo",
        owner: "Automation (dc-email-api)",
        note: "Tag subscribers by capture source so sends can target",
      },
      {
        name: "Blast production checklist",
        status: "todo",
        owner: "PD",
        note: "Who writes / designs / approves / sends",
      },
    ],
  },
  {
    area: "Merch",
    sops: [
      {
        name: "Drop process",
        status: "todo",
        owner: "PD + freelance design",
        note: "Small-batch, self-fulfilled, evergreen",
      },
      {
        name: "Inventory + fulfillment check",
        status: "todo",
        owner: "PD",
        note: "Folds into the weekly review — not standalone",
      },
    ],
  },
  {
    area: "Events",
    sops: [
      {
        name: "Offer creation",
        status: "draft",
        owner: "PD (skill), Geo (send)",
        note: "Skill exists — Discord bot deploy planned",
      },
      {
        name: "Post-offer through day-of",
        status: "todo",
        owner: "Geo",
        note: "Runs seamlessly in Geo's head — write down as backup",
      },
    ],
  },
];

export function findSopBySlug(slug: string): Sop | undefined {
  return SOP_AREAS.flatMap((a) => a.sops).find((s) => s.slug === slug);
}

export function sopCounts(): { live: number; draft: number; todo: number } {
  const all = SOP_AREAS.flatMap((a) => a.sops);
  return {
    live: all.filter((s) => s.status === "live").length,
    draft: all.filter((s) => s.status === "draft").length,
    todo: all.filter((s) => s.status === "todo").length,
  };
}
