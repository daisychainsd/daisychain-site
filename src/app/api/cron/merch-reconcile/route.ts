import { reconcilePhysicalOrders } from "@/lib/merch/reconcile";
import { alertMerchIssue } from "@/lib/merch/email";

export const maxDuration = 300;
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { report } = await reconcilePhysicalOrders(true);
    if (report.failures.length) throw new Error(`${report.failures.length} physical orders could not be reconciled: ${JSON.stringify(report.failures)}`);
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Physical order reconciliation failed:", error);
    try { await alertMerchIssue(`reconciliation-${new Date().toISOString().slice(0, 10)}`, "Physical order reconciliation failed. Check Merch Ops and server logs; paid website orders may be missing."); }
    catch (alertError) { console.error("Order reconciliation alert failed:", alertError); }
    return Response.json({ error: "Physical order reconciliation failed" }, { status: 503 });
  }
}
