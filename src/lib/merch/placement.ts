import type { MerchProduct } from "./types";

export interface MerchPlacement { productId?: string }
export interface MerchSelection { manualSelection?: boolean; products?: MerchPlacement[] }

export function selectMerchProducts(products: MerchProduct[], selection?: MerchSelection | null, defaultLimit?: number) {
  if (!selection?.manualSelection) return defaultLimit == null ? products : products.slice(0, defaultLimit);
  const byId = new Map(products.map(p => [p.id, p]));
  const seen = new Set<string>();
  return (selection.products ?? []).flatMap(({ productId }) => {
    if (!productId || seen.has(productId)) return [];
    seen.add(productId);
    const product = byId.get(productId);
    return product ? [product] : [];
  });
}
