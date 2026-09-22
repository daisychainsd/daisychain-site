import { createHash } from "node:crypto";
import { reconcileBandcampOrders } from "./bandcamp";
import { alertMerchIssue } from "./email";

export async function runBandcampCron(req: Request, secret = process.env.CRON_SECRET,
  run = reconcileBandcampOrders, alert = alertMerchIssue) {
  const headers = { "Cache-Control": "no-store" };
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  try {
    const { report } = await run(true);
    if (report.failures.length) throw new Error(JSON.stringify(report.failures));
    return Response.json(report, { headers });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown failure";
    console.error("Bandcamp physical order reconciliation failed:", detail);
    const key = createHash("sha256").update(detail).digest("hex").slice(0, 16);
    await alert(`bandcamp-reconcile-${new Date().toISOString().slice(0, 10)}-${key}`,
      `Bandcamp physical order sync failed. Check Merch Ops and the Bandcamp feed. ${detail.slice(0, 1200)}`).catch(() => {});
    return Response.json({ error: "Bandcamp physical order sync failed" }, { status: 503, headers });
  }
}
