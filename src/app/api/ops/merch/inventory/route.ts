import { createAdminClient } from "@/lib/supabase/admin";
import { requireOps, opsError, OpsRequestError, uuid } from "@/lib/merch/auth";

export async function POST(req: Request) {
  try {
    requireOps(req, true);
    const { variantId, delta, reason, requestId } = await req.json();
    if (typeof variantId !== "string" || !Number.isInteger(delta) || !delta || Math.abs(delta) > 100000 ||
      typeof reason !== "string" || !reason.trim() || reason.length > 300 || typeof requestId !== "string" || !uuid.test(requestId)) throw new OpsRequestError("Enter an item, quantity change and reason");
    const { data, error } = await createAdminClient().rpc("adjust_merch_inventory", { variant: variantId, delta, reason_text: reason, request_key: requestId });
    if (error) throw new OpsRequestError(error.message, 409);
    return Response.json({ stock: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return opsError(error); }
}
