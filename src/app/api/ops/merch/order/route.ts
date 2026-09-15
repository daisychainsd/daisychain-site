import { createAdminClient } from "@/lib/supabase/admin";
import { requireOps, opsError, OpsRequestError, uuid } from "@/lib/merch/auth";

export async function POST(req: Request) {
  try {
    requireOps(req, true);
    const body = await req.json();
    if (typeof body.id !== "string" || !uuid.test(body.id) || typeof body.status !== "string" ||
      typeof body.tracking !== "string" || typeof body.notes !== "string" || typeof body.resolveStock !== "boolean") throw new OpsRequestError("Invalid order update");
    const { error } = await createAdminClient().rpc("update_merch_order", {
      order_id: body.id, next_status: body.status, tracking: body.tracking, note: body.notes, resolve_stock: body.resolveStock,
    });
    if (error) throw new OpsRequestError(error.message, 409);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return opsError(error); }
}
