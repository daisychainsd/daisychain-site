import { thumbnailStyle } from "@/lib/merch/thumbnail";
import Link from "next/link";
import { getProducts } from "@/lib/merch/storefront";
import type { MerchProduct } from "@/lib/merch/types";
import SectionHeader from "@/components/SectionHeader";
import MerchPrice from "@/components/MerchPrice";
import { productCompareAtPrice } from "@/lib/merch/sale";
import { selectMerchProducts, type MerchSelection } from "@/lib/merch/placement";

/**
 * Append Shopify CDN size params to an image URL so we never download a 2000px image
 * into a 240px slot. Safe on non-Shopify URLs (just returns the original).
 */
function shopifyImg(url: string, width: number) {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("shopify.com") && !u.hostname.endsWith("myshopify.com")) {
      return url;
    }
    u.searchParams.set("width", String(width));
    return u.toString();
  } catch {
    return url;
  }
}

export default async function ShopStrip({ limit = 4, selection }: { limit?: number; selection?: MerchSelection }) {
  let products: MerchProduct[] = [];
  try {
    products = await getProducts();
  } catch {
    products = [];
  }

  const items = selectMerchProducts(products, selection, limit);
  if (items.length === 0) return null;

  return (
    <section
      className="max-w-[1440px] mx-auto"
      style={{ padding: "clamp(40px, 5vw, 56px) clamp(24px, 4vw, 48px)" }}
    >
      <SectionHeader
        kicker="Merch + Wax"
        title="Shop"
        seeAllHref="/shop"
        seeAllLabel="All items"
      />
      <div
        className="grid gap-5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gridAutoRows: "1fr" }}
      >
        {items.map((product, idx) => {
          const img = product.images.edges[0]?.node;
          const price = Number(product.priceRange.minVariantPrice.amount);
          const isNew = !selection?.manualSelection && idx < 2;
          return (
            <Link
              key={product.id}
              href={`/shop/${product.handle}`}
              className="group flex flex-col h-full hover-lift"
              style={{
                borderRadius: "var(--radius-organic-md)",
                background: "var(--color-bg-surface)",
                border: "1px solid rgba(255,255,255,0.06)",
                padding: 8,
              }}
            >
              <div
                className="relative aspect-square overflow-hidden"
                style={{
                  borderRadius: "var(--radius-organic-inv-md)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  background: "var(--color-bg-raised)",
                }}
              >
                {img ? (
                  <img
                    src={shopifyImg(img.url, 480)}
                    alt={img.altText || product.title}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full"
              style={thumbnailStyle(img.thumbnailCrop)}
                  />
                ) : null}
                {isNew && (
                  <span
                    className="absolute top-2.5 right-2.5 uppercase"
                    style={{
                      background: "var(--color-blue-300)",
                      color: "var(--color-bg-deep)",
                      padding: "3px 10px",
                      borderRadius: 999,
                      fontFamily: "var(--font-heading), system-ui, sans-serif",
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      fontWeight: 700,
                    }}
                  >
                    New
                  </span>
                )}
              </div>
              <div className="px-2.5 pt-3.5 pb-2.5 flex flex-col flex-1">
                <p className="text-text-primary text-[15px] m-0" style={{ fontWeight: 600 }}>
                  {product.title}
                </p>
                <p className="text-text-secondary text-[13px] m-0 mt-1">
                  {product.productType || "—"}
                </p>
                <div className="flex flex-wrap justify-between items-center gap-2 mt-auto pt-3">
                  <MerchPrice price={price} maxPrice={Number(product.priceRange.maxVariantPrice.amount)} compareAtPrice={productCompareAtPrice(product)} discountPercent={product.discountPercent} currency={product.priceRange.minVariantPrice.currencyCode} />
                  <span
                    className="uppercase"
                    style={{
                      padding: "7px 14px",
                      borderRadius: "var(--radius-pill-right)",
                      border: "1px solid rgba(124,185,232,0.2)",
                      background: "rgba(124,185,232,0.05)",
                      color: "var(--color-blue-300)",
                      fontFamily: "var(--font-heading), system-ui, sans-serif",
                      fontWeight: 700,
                      fontSize: 11,
                      letterSpacing: "0.08em",
                    }}
                  >
                    View
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
