import { NextRequest, NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/ops-health";
import { sendOpsHealthAlert } from "@/lib/email";

/**
 * Daily ops health cron. Runs the same checks as the /ops dashboard and
 * emails ALERT_EMAIL (via Resend) when any system is failing. Sends nothing
 * when all green.
 *
 * Schedule (vercel.json): `0 14 * * *` UTC (daily, ~7am PT).
 * Auth: `Authorization: Bearer ${CRON_SECRET}` — same as release-day.
 * Manual test must hit www.daisychainsd.com (bare domain 307 strips the header).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await runHealthChecks();
  const failing = health.checks.filter((c) => !c.ok);

  if (failing.length > 0) {
    await sendOpsHealthAlert(failing);
  }

  return NextResponse.json({
    ok: failing.length === 0,
    alerted: failing.length > 0,
    failing: failing.map((f) => f.name),
    checks: health.checks,
    checkedAt: health.checkedAt,
  });
}
