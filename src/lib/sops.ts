// SOP data for the /ops dashboard.
// Source of truth is Sanity ("SOPs" in /studio) — add/edit SOPs and their
// reference links there, no code changes needed.

import { sanityFetch } from "@/sanity/client";
import { SOP_AREA_ORDER } from "@/sanity/schemas/sop";

export type SopStatus = "live" | "draft" | "todo";

export type SopLink = { label: string; href: string };

export type Sop = {
  name: string;
  area: string;
  status: SopStatus;
  owner?: string;
  note?: string;
  links?: SopLink[];
  slug?: string;
  docId?: string;
};

export type SopArea = { area: string; sops: Sop[] };

const SOP_FIELDS = `
  name,
  area,
  status,
  owner,
  note,
  links[]{ label, "href": url },
  "slug": slug.current,
  docId
`;

export async function getSopAreas(): Promise<SopArea[]> {
  const sops = await sanityFetch<Sop>(
    `*[_type == "sop"] | order(order asc, name asc) { ${SOP_FIELDS} }`
  );
  const areas = [
    ...SOP_AREA_ORDER,
    ...sops.map((s) => s.area).filter((a) => a && !SOP_AREA_ORDER.includes(a)),
  ];
  return areas
    .map((area) => ({ area, sops: sops.filter((s) => s.area === area) }))
    .filter((a) => a.sops.length > 0);
}

export async function findSopBySlug(slug: string): Promise<Sop | undefined> {
  const rows = await sanityFetch<Sop>(
    `*[_type == "sop" && slug.current == $slug][0...1] { ${SOP_FIELDS} }`,
    { slug }
  );
  return rows[0];
}

export function sopCounts(areas: SopArea[]): {
  live: number;
  draft: number;
  todo: number;
} {
  const all = areas.flatMap((a) => a.sops);
  return {
    live: all.filter((s) => s.status === "live").length,
    draft: all.filter((s) => s.status === "draft").length,
    todo: all.filter((s) => s.status === "todo").length,
  };
}
