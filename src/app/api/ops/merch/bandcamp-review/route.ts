import { createAdminClient } from "@/lib/supabase/admin";
import { requireOps, opsError, OpsRequestError, uuid } from "@/lib/merch/auth";

export async function POST(request: Request) {
  try {
    requireOps(request, true);
    const body = await request.json();
    if (typeof body.id !== "string" || !uuid.test(body.id) || typeof body.note !== "string" || !body.note.trim() || body.note.length > 500 || !body.snapshot || typeof body.snapshot !== "object" || Array.isArray(body.snapshot)) throw new OpsRequestError("Add a review note");
    const { error } = await createAdminClient().rpc("accept_bandcamp_order", { order_id: body.id, review_note: body.note, expected_snapshot: body.snapshot });
    if (error) throw new OpsRequestError(error.message, 409);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return opsError(error); }
}
