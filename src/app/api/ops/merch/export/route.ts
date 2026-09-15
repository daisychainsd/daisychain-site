import { createAdminClient } from "@/lib/supabase/admin";
import { pirateShipCsv } from "@/lib/merch/csv";
import type { MerchOrder } from "@/lib/merch/types";
import { requireOps, opsError, OpsRequestError, uuid } from "@/lib/merch/auth";

export async function POST(req: Request) {
  try {
    requireOps(req, true);
    const { ids, requestId, reexport } = await req.json();
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || ids.some((id) => typeof id !== "string" || !uuid.test(id)) ||
      typeof requestId !== "string" || !uuid.test(requestId) || (reexport !== undefined && typeof reexport !== "boolean")) throw new OpsRequestError("Invalid order selection");
    const { data, error } = await createAdminClient().rpc("export_merch_orders", { ids, request_key: requestId, reexport: reexport === true });
    if (error) throw new OpsRequestError(error.message, 409);
    return new Response(pirateShipCsv(data as MerchOrder[]), { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="daisy-chain-shipping-${new Date().toISOString().slice(0, 10)}.csv"`,
    } });
  } catch (error) { return opsError(error); }
}
