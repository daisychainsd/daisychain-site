import { NextRequest, NextResponse } from "next/server";
import { runCatalogAudit } from "@/lib/catalog-audit";
import { sendCatalogAuditReport } from "@/lib/email";

/**
 * Weekly catalog audit cron — see src/lib/catalog-audit.ts for what it checks.
 * Always emails ALERT_EMAIL a report (even when all clear) — the email is the
 * anchor for the W3 weekly review ritual.
 *
 * Schedule (vercel.json): `0 14 * * 1` UTC (Mondays ~7am PT).
 * Auth: `Authorization: Bearer ${CRON_SECRET}` — same as the other crons.
 * Manual test must hit www.daisychainsd.com (bare domain 307 strips the header).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { findings, counts } = await runCatalogAudit();
  await sendCatalogAuditReport({ findings, counts });

  return NextResponse.json({
    ok: findings.filter((f) => f.kind === "broken").length === 0,
    counts,
    findings,
    checkedAt: new Date().toISOString(),
  });
}
