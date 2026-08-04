import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findSopBySlug } from "@/lib/sops";

export const metadata: Metadata = {
  title: "SOP",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sop = await findSopBySlug(slug);
  if (!sop || !sop.docId) notFound();

  const previewUrl = `https://docs.google.com/document/d/${sop.docId}/preview`;
  const editUrl = `https://docs.google.com/document/d/${sop.docId}/edit`;
  const pdfUrl = `https://docs.google.com/document/d/${sop.docId}/export?format=pdf`;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <Link
            href="/ops"
            className="text-blue-300 uppercase inline-block mb-2.5 hover:underline"
            style={{
              fontFamily: "var(--font-heading), system-ui, sans-serif",
              fontSize: 11,
              letterSpacing: "0.12em",
            }}
          >
            ← Ops
          </Link>
          <h1
            className="uppercase text-text-primary m-0"
            style={{
              fontFamily: "var(--font-heading), system-ui, sans-serif",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 0.95,
              fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
            }}
          >
            {sop.name}
          </h1>
        </div>
        <div
          className="flex items-center gap-4 pb-1"
          style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12 }}
        >
          <a
            href={editUrl}
            target="_blank"
            rel="noreferrer"
            className="text-blue-300 hover:underline"
          >
            Edit in Docs →
          </a>
          <a
            href={pdfUrl}
            className="text-blue-300 hover:underline"
          >
            PDF →
          </a>
        </div>
      </div>

      <div className="container-organic overflow-hidden p-2">
        {/* ponytail: Google Doc preview embed — the Doc is the editable source
            of truth; edits appear here on refresh with no site deploy. */}
        <iframe
          src={previewUrl}
          title={`SOP — ${sop.name}`}
          className="w-full border-0 rounded-[inherit] bg-white"
          style={{ height: "80vh" }}
        />
      </div>
    </div>
  );
}
