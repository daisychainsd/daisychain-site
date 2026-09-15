import type Stripe from "stripe";
import type { OrderItem } from "./types";

type LegacyVariant = { id: string; title: string; sku: string; merch_products: { title: string } };

/** Match captured Stripe product descriptions, never the API's line ordering. */
export function reconcileLegacyItems(requested: { vid: string; qty: number }[], lines: Stripe.LineItem[], catalog: LegacyVariant[]): OrderItem[] {
  if (!Array.isArray(requested) || !requested.length || requested.length !== lines.length) throw new Error("Legacy order needs reconciliation");
  const remaining = [...requested];
  return lines.map((line) => {
    const product = line.price?.product;
    if (!product || typeof product === "string" || product.deleted) throw new Error("Legacy product details unavailable");
    const variantTitle = product.description || "Default Title";
    const candidates = remaining.filter((r) => {
      const v = catalog.find((v) => v.id === r.vid);
      return Number.isSafeInteger(r.qty) && r.qty > 0 && r.qty === line.quantity && v?.title === variantTitle && v.merch_products.title === product.name;
    });
    if (candidates.length !== 1) throw new Error("Legacy order needs manual variant reconciliation before retrying");
    const match = candidates[0];
    remaining.splice(remaining.indexOf(match), 1);
    const variant = catalog.find((v) => v.id === match.vid)!;
    return { variant_id: variant.id, quantity: match.qty, title: product.name, variant_title: variantTitle,
      sku: variant.sku, unit_price_cents: line.price?.unit_amount ?? Math.round(line.amount_subtotal / match.qty) };
  });
}
