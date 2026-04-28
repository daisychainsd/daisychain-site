import Link from "next/link";
import { getProducts } from "@/lib/shopify";
import type { ShopifyProduct } from "@/lib/shopify";
import SectionHeader from "@/components/SectionHeader";

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

function ProductCard({ product, isNew = false }: { product: ShopifyProduct; isNew?: boolean }) {
  const image = product.images.edges[0]?.node;
  const price = parseFloat(product.priceRange.minVariantPrice.amount);
  const maxPrice = parseFloat(product.priceRange.maxVariantPrice.amount);
  const hasRange = price !== maxPrice;
  const variants = product.variants.edges.map((e) => e.node);
  const variantCount = variants.filter((v) => v.title !== "Default Title").length;

  return (
    <Link href={`/shop/${product.handle}`} className="group block hover-lift">
      <div
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
          {image ? (
            <img
              src={shopifyImg(image.url, 480)}
              alt={image.altText || product.title}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover image-hover-card-zoom"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-text-muted text-xs p-4 text-center">
              {product.title}
            </div>
          )}

          {isNew && product.availableForSale && (
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

          {!product.availableForSale && (
            <div className="absolute inset-0 bg-bg-deep/60 flex items-center justify-center">
              <span
                className="uppercase"
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.6)",
                  backdropFilter: "blur(6px)",
                  color: "rgba(255,255,255,0.9)",
                  fontFamily: "var(--font-heading), system-ui, sans-serif",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  fontWeight: 700,
                }}
              >
                Sold Out
              </span>
            </div>
          )}
        </div>

        <div className="px-2.5 pt-3.5 pb-2.5">
          <p className="text-text-primary text-[15px] font-semibold m-0 truncate">
            {product.title}
          </p>
          {product.productType && (
            <p className="text-text-secondary text-[13px] m-0 mt-1">{product.productType}</p>
          )}
          <div className="flex items-center justify-between mt-3">
            <span
              className="text-blue-300"
              style={{ fontFamily: "var(--font-mono), monospace", fontSize: 14 }}
            >
              {hasRange ? `From $${price.toFixed(2)}` : `$${price.toFixed(2)}`}
            </span>
            {variantCount > 0 && product.availableForSale ? (
              <span className="text-text-muted text-xs">
                {variantCount} {variantCount === 1 ? "option" : "options"}
              </span>
            ) : (
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
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default async function ShopPage() {
  const products = await getProducts();

  return (
    <div
      className="max-w-[1440px] mx-auto relative overflow-hidden"
      style={{ padding: "clamp(40px, 5vw, 56px) clamp(24px, 4vw, 48px)" }}
    >
      <div className="blob w-[400px] h-[400px] bg-blue-300 top-[-100px] right-[-150px] animate-drift" />

      <div className="relative flex items-end justify-between gap-4 flex-wrap mb-9">
        <SectionHeader kicker="Merch + Wax" title="Shop" size="xl" as="h1" />
        <span
          className="text-text-muted"
          style={{ fontFamily: "var(--font-mono), monospace", fontSize: 13 }}
        >
          {products.length} {products.length === 1 ? "item" : "items"} · free US shipping over $50
        </span>
      </div>

      {products.length > 0 ? (
        <div
          className="relative grid gap-5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
        >
          {products.map((product, idx) => (
            <ProductCard key={product.id} product={product} isNew={idx < 2} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-text-muted text-lg">merch drops soon — stay tuned.</p>
        </div>
      )}
    </div>
  );
}
