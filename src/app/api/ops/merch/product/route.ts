import { isThumbnailCrop } from "@/lib/merch/thumbnail";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOps, opsError, OpsRequestError } from "@/lib/merch/auth";
import type { ProductEditInput } from "@/lib/merch/types";
import { discountedCents, isDiscountPercent } from "@/lib/merch/sale";

export async function POST(req: Request) {
  try {
    requireOps(req, true);
    const p: ProductEditInput = await req.json();
    if (typeof p.title !== "string" || !p.title.trim() || p.title.length > 200 || typeof p.handle !== "string" ||
      !/^[a-z0-9][a-z0-9-]{0,150}$/.test(p.handle) || typeof p.description !== "string" || p.description.length > 10000 ||
      typeof p.product_type !== "string" || p.product_type.length > 100 || typeof p.active !== "boolean" ||
      !Array.isArray(p.merch_variants) || p.merch_variants.length < 1 || p.merch_variants.length > 100 ||
      !Array.isArray(p.images) || p.images.length > 20 || (p.id && (typeof p.id !== "string" || p.id.length > 200))) throw new OpsRequestError("Check the product name, handle and variants");
    const id = p.id || `merch-product-${randomUUID()}`;
    if (!isDiscountPercent(p.discount_percent)) throw new OpsRequestError("Choose a whole-number discount from 0 to 99%");
    const discountPercent = p.discount_percent;
    const variants = p.merch_variants.map((v, index) => {
      if (v.regular_price_cents == null) throw new OpsRequestError("Reload the product editor before saving prices or discounts");
      if (typeof v.title !== "string" || !v.title.trim() || v.title.length > 200 || typeof v.sku !== "string" || v.sku.length > 100 ||
        !Number.isSafeInteger(v.regular_price_cents) || v.regular_price_cents < 1 || v.regular_price_cents > 10000000 || typeof v.active !== "boolean" ||
        (v.id && (typeof v.id !== "string" || v.id.length > 200)) || !Array.isArray(v.selected_options) || v.selected_options.length > 3 ||
        v.selected_options.some((o) => typeof o.name !== "string" || !o.name || o.name.length > 100 || typeof o.value !== "string" || !o.value || o.value.length > 100)) throw new OpsRequestError("Each variant needs a title, price and valid options");
      const saleCents = discountedCents(v.regular_price_cents, discountPercent);
      if (saleCents < 1 || (discountPercent > 0 && saleCents >= v.regular_price_cents)) throw new OpsRequestError("The discount must reduce each price by at least one cent and keep it above zero");
      return { id: v.id || `merch-variant-${randomUUID()}`, title: v.title, sku: v.sku,
        regular_price_cents: v.regular_price_cents, active: v.active, selected_options: v.selected_options, sort_order: index };
    });
    if (new Set(variants.map((v) => v.id)).size !== variants.length) throw new OpsRequestError("Duplicate variant");
    for (const image of p.images) {
      if (image.thumbnailCrop != null && !isThumbnailCrop(image.thumbnailCrop)) throw new OpsRequestError("Thumbnail zoom must be 1–3 and positions must be 0–100");
      if (typeof image.url !== "string" || image.url.length > 2000 || !/^https:\/\//.test(image.url) ||
        (image.altText != null && typeof image.altText !== "string")) throw new OpsRequestError("Invalid image URL");
    }
    const options = new Map<string, Set<string>>();
    variants.forEach((v) => v.selected_options.forEach((o) => {
      const values = options.get(o.name) ?? new Set<string>(); values.add(o.value); options.set(o.name, values);
    }));
    const { error } = await createAdminClient().rpc("save_merch_product", { payload: {
      id, handle: p.handle, title: p.title.trim(), description: p.description, product_type: p.product_type, active: p.active,
      discount_percent: discountPercent,
      images: p.images, options: Array.from(options, ([name, values]) => ({ name, values: [...values] })), merch_variants: variants,
    } });
    if (error) throw new OpsRequestError(error.code === "23505" ? "That handle is already in use" : "Could not save the product", 409);
    return Response.json({ ok: true, id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return opsError(error); }
}
