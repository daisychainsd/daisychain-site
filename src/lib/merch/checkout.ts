import type { CatalogProduct, OrderItem } from "./types";

export class MerchInputError extends Error {}

export function normalizeCart(items: unknown): { variantId: string; quantity: number }[] {
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    throw new MerchInputError("Select between 1 and 20 items.");
  }
  const merged = new Map<string, number>();
  for (const item of items) {
    if (!item || typeof item.variantId !== "string" || item.variantId.length > 200 ||
      !item.variantId.trim() || typeof item.quantity !== "number" || !Number.isInteger(item.quantity) ||
      item.quantity < 1 || item.quantity > 10) throw new MerchInputError("Invalid cart item.");
    const quantity = (merged.get(item.variantId) ?? 0) + item.quantity;
    if (quantity > 10) throw new MerchInputError("Maximum quantity is 10 per item.");
    merged.set(item.variantId, quantity);
  }
  return Array.from(merged, ([variantId, quantity]) => ({ variantId, quantity }));
}

export function priceCart(items: ReturnType<typeof normalizeCart>, products: CatalogProduct[]): OrderItem[] {
  return items.map(({ variantId, quantity }) => {
    const p = products.find((p) => p.active && p.merch_variants.some((v) => v.id === variantId));
    const v = p?.merch_variants.find((v) => v.id === variantId && v.active);
    if (!p || !v) throw new MerchInputError("An item is unavailable. Please update your cart.");
    if (v.stock < quantity) throw new MerchInputError(`Only ${Math.max(0, v.stock)} remaining: ${p.title} / ${v.title}.`);
    if (v.currency !== "usd" || !Number.isSafeInteger(v.price_cents) || v.price_cents < 1) {
      throw new Error("Invalid catalog price");
    }
    return { variant_id: v.id, title: p.title, variant_title: v.title,
      sku: v.sku, quantity, unit_price_cents: v.price_cents };
  });
}
