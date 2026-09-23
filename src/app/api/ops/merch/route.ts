import { listOrders } from "@/lib/merch/orders";
import { getCatalog } from "@/lib/merch/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOps, opsError, OpsRequestError } from "@/lib/merch/auth";

export async function GET(req: Request) {
  try {
    requireOps(req);
    const params = new URL(req.url).searchParams;
    const status = params.get("status") ?? "unshipped";
    const page = Number(params.get("page") ?? 0);
    const source = params.get("source") ?? "all";
    if (!["all", "website", "bandcamp"].includes(source)) throw new OpsRequestError("Invalid source");
    if (!["new", "unshipped", "exported", "shipped", "on_hold", "all"].includes(status) || !Number.isInteger(page) || page < 0 || page > 10000) throw new OpsRequestError("Invalid filter");
    const db = createAdminClient();
    const [orders, products, ledger, count] = await Promise.all([
      listOrders(status, params.get("test") === "true", page, source), getCatalog(true),
      db.from("merch_inventory_adjustments").select("*").order("created_at", { ascending: false }).limit(50),
      db.from("merch_orders").select("id", { count: "exact", head: true }).eq("livemode", true).eq("fulfillment_status", "new"),
    ]);
    if (ledger.error || count.error) throw new Error("Merch database unavailable");
    return Response.json({ orders, products, adjustments: ledger.data, newOrders: count.count }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return opsError(error); }
}
