import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOps, opsError, OpsRequestError } from "@/lib/merch/auth";
import type { CatalogProduct } from "@/lib/merch/types";

export async function POST(req: Request) {
  try {
    requireOps(req, true);
    const p: CatalogProduct = await req.json();
    if (typeof p.title !== "string" || !p.title.trim() || p.title.length > 200 || typeof p.handle !== "string" ||
      !/^[a-z0-9][a-z0-9-]{0,150}$/.test(p.handle) || typeof p.description !== "string" || p.description.length > 10000 ||
      typeof p.product_type !== "string" || p.product_type.length > 100 || typeof p.active !== "boolean" ||
      !Array.isArray(p.merch_variants) || p.merch_variants.length < 1 || p.merch_variants.length > 100 ||
      !Array.isArray(p.images) || p.images.length > 20 || (p.id && (typeof p.id !== "string" || p.id.length > 200))) throw new OpsRequestError("Check the product name, handle and variants");
    const id = p.id || `merch-product-${randomUUID()}`;
    const variants = p.merch_variants.map((v, index) => {
      if (typeof v.title !== "string" || !v.title.trim() || v.title.length > 200 || typeof v.sku !== "string" || v.sku.length > 100 ||
        !Number.isSafeInteger(v.price_cents) || v.price_cents < 1 || v.price_cents > 10000000 || typeof v.active !== "boolean" ||
        (v.id && (typeof v.id !== "string" || v.id.length > 200)) || !Array.isArray(v.selected_options) || v.selected_options.length > 3 ||
        v.selected_options.some((o) => typeof o.name !== "string" || !o.name || o.name.length > 100 || typeof o.value !== "string" || !o.value || o.value.length > 100)) throw new OpsRequestError("Each variant needs a title, price and valid options");
      return { id: v.id || `merch-variant-${randomUUID()}`, title: v.title, sku: v.sku,
        price_cents: v.price_cents, active: v.active, selected_options: v.selected_options, sort_order: index };
    });
    if (new Set(variants.map((v) => v.id)).size !== variants.length) throw new OpsRequestError("Duplicate variant");
    for (const image of p.images) {
      if (typeof image.url !== "string" || image.url.length > 2000 || !/^https:\/\//.test(image.url) ||
        (image.altText != null && typeof image.altText !== "string")) throw new OpsRequestError("Invalid image URL");
    }
    const options = new Map<string, Set<string>>();
    variants.forEach((v) => v.selected_options.forEach((o) => {
      const values = options.get(o.name) ?? new Set<string>(); values.add(o.value); options.set(o.name, values);
    }));
    const { error } = await createAdminClient().rpc("save_merch_product", { payload: {
      id, handle: p.handle, title: p.title.trim(), description: p.description, product_type: p.product_type, active: p.active,
      images: p.images, options: Array.from(options, ([name, values]) => ({ name, values: [...values] })), merch_variants: variants,
    } });
    if (error) throw new OpsRequestError(error.code === "23505" ? "That handle is already in use" : "Could not save the product", 409);
    return Response.json({ ok: true, id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return opsError(error); }
}
