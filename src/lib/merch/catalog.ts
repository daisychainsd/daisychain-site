import { createAdminClient } from "@/lib/supabase/admin";
import type { CatalogProduct, MerchProduct } from "./types";

export async function getCatalog(includeInactive = false): Promise<CatalogProduct[]> {
  let query = createAdminClient().from("merch_products")
    .select("*, merch_variants(*)").order("created_at", { ascending: false });
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(`Merch catalog unavailable: ${error.message}`);
  return data as CatalogProduct[];
}

function storefrontProduct(p: CatalogProduct): MerchProduct {
  const variants = p.merch_variants.filter((v) => v.active).sort((a, b) => a.sort_order - b.sort_order);
  const prices = variants.map((v) => v.price_cents);
  const price = (cents: number) => ({ amount: (cents / 100).toFixed(2), currencyCode: "USD" });
  return {
    id: p.id, title: p.title, handle: p.handle,
    description: p.description, descriptionHtml: "", productType: p.product_type,
    tags: p.tags, options: p.options,
    availableForSale: variants.some((v) => v.stock > 0),
    priceRange: {
      minVariantPrice: price(prices.length ? Math.min(...prices) : 0),
      maxVariantPrice: price(prices.length ? Math.max(...prices) : 0),
    },
    images: { edges: p.images.map((node) => ({ node })) },
    variants: { edges: variants.map((v) => ({ node: {
      id: v.id, title: v.title, selectedOptions: v.selected_options,
      availableForSale: v.stock > 0, price: price(v.price_cents),
    } })) },
  };
}

export async function getProducts(): Promise<MerchProduct[]> {
  return (await getCatalog()).map(storefrontProduct);
}

export async function getProductByHandle(handle: string): Promise<MerchProduct | null> {
  const { data, error } = await createAdminClient().from("merch_products")
    .select("*, merch_variants(*)").eq("handle", handle).eq("active", true).maybeSingle();
  if (error) throw new Error(`Merch catalog unavailable: ${error.message}`);
  return data ? storefrontProduct(data as CatalogProduct) : null;
}
