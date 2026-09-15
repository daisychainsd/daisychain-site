import { createAdminClient } from "@/lib/supabase/admin";
import { requireOps, opsError, OpsRequestError } from "@/lib/merch/auth";
import { randomUUID } from "node:crypto";

export async function POST(req: Request) {
  try {
    requireOps(req, true);
    if (Number(req.headers.get("content-length")) > 4_100_000) throw new OpsRequestError("Maximum image size is 4 MB");
    const file = (await req.formData()).get("image");
    const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    if (!(file instanceof File) || !extensions[file.type] || file.size > 4_000_000) throw new OpsRequestError("Choose a JPG, PNG or WebP under 4 MB");
    const storage = createAdminClient().storage;
    const path = `${randomUUID()}.${extensions[file.type]}`;
    const { error } = await storage.from("merch-images").upload(path, await file.arrayBuffer(), { contentType: file.type });
    if (error) throw new Error(error.message);
    return Response.json({ url: storage.from("merch-images").getPublicUrl(path).data.publicUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return opsError(error); }
}
