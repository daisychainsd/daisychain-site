import Link from "next/link";
import { getProducts, type ShopifyProduct } from "@/lib/shopify";
import SectionHeader from "@/components/SectionHeader";

function formatPrice(amount: string) {
  const n = Number(amount);
  if (Number.isNaN(n)) return amount;
  return n.toFixed(2);
}

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

export default async function ShopStrip({ limit = 4 }: { limit?: number }) {
  let products: ShopifyProduct[] = [];
  try {
    products = await getProducts();
  } catch {
    products = [];
  }

  const items = products.slice(0, limit);
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
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}
      >
        {items.map((product, idx) => {
          const img = product.images.edges[0]?.node;
          const price = formatPrice(product.priceRange.minVariantPrice.amount);
          const isNew = idx < 2; // fallback heuristic: newest two get the NEW pill
          return (
            <Link
              key={product.id}
              href={`/shop/${product.handle}`}
              className="group block hover-lift"
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
                    className="absolute inset-0 w-full h-full object-cover image-hover-card-zoom"
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
              <div className="px-2.5 pt-3.5 pb-2.5">
                <p className="text-text-primary text-[15px] m-0" style={{ fontWeight: 600 }}>
                  {product.title}
                </p>
                <p className="text-text-secondary text-[13px] m-0 mt-1">
                  {product.productType || "—"}
                </p>
                <div className="flex justify-between items-center mt-3">
                  <span
                    className="text-blue-300"
                    style={{ fontFamily: "var(--font-mono), monospace", fontSize: 14 }}
                  >
                    ${price}
                  </span>
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
