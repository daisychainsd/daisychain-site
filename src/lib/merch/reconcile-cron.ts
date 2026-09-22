import { createHash } from "node:crypto";
import { reconcilePhysicalOrders } from "./reconcile";
import { alertMerchIssue } from "./email";

interface CronDependencies {
  run: typeof reconcilePhysicalOrders;
  alert: typeof alertMerchIssue;
}
export async function runReconciliationCron(req: Request, secret = process.env.CRON_SECRET, deps: CronDependencies = { run: reconcilePhysicalOrders, alert: alertMerchIssue }) {
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { report } = await deps.run(true);
    if (report.failures.length) throw new Error(`${report.failures.length} physical orders could not be reconciled: ${JSON.stringify(report.failures)}`);
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Physical order reconciliation failed:", error);
    const detail = error instanceof Error ? error.message : "Unexpected reconciliation failure";
    const fingerprint = createHash("sha256").update(detail).digest("hex").slice(0, 16);
    try {
      await deps.alert(`reconciliation-${new Date().toISOString().slice(0, 10)}-${fingerprint}`, `Physical order reconciliation failed. Paid website orders may be missing. ${detail.slice(0, 1500)}. Check Merch Ops and server logs.`);
    } catch (alertError) { console.error("Order reconciliation alert failed:", alertError); }
    return Response.json({ error: "Physical order reconciliation failed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
