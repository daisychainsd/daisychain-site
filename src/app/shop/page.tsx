import Link from "next/link";
import { getProducts } from "@/lib/shopify";
import type { ShopifyProduct } from "@/lib/shopify";

function ProductCard({ product }: { product: ShopifyProduct }) {
  const image = product.images.edges[0]?.node;
  const price = parseFloat(product.priceRange.minVariantPrice.amount);
  const maxPrice = parseFloat(product.priceRange.maxVariantPrice.amount);
  const hasRange = price !== maxPrice;
  const variants = product.variants.edges.map((e) => e.node);
  const variantCount = variants.filter(
    (v) => v.title !== "Default Title",
  ).length;

  return (
    <Link href={`/shop/${product.handle}`} className="group block">
      <div className="container-organic-md p-2 hover-lift">
        <div className="container-inset-md aspect-square relative overflow-hidden">
          {image ? (
            <img
              src={image.url}
              alt={image.altText || product.title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-muted text-xs bg-bg-raised">
              {product.title}
            </div>
          )}

          {!product.availableForSale && (
            <div className="absolute inset-0 bg-bg-deep/60 flex items-center justify-center">
              <span className="px-3 py-1 rounded-full bg-bg-surface/90 text-text-muted text-xs font-semibold uppercase tracking-wider">
                Sold Out
              </span>
            </div>
          )}
        </div>

        <div className="px-3 pt-3 pb-3">
          <p className="text-text-primary font-semibold text-base truncate">
            {product.title}
          </p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-blue-300 text-sm font-medium">
              {hasRange ? `From $${price.toFixed(2)}` : `$${price.toFixed(2)}`}
            </p>
            {variantCount > 0 && product.availableForSale && (
              <p className="text-text-muted text-xs">
                {variantCount} {variantCount === 1 ? "option" : "options"}
              </p>
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
    <div className="max-w-7xl mx-auto px-6 py-12 relative">
      <div className="blob w-[400px] h-[400px] bg-amber-300 top-[-100px] right-[-150px] animate-drift" />

      <div className="mb-10">
        <p className="text-label mb-2">Merch</p>
        <h1 className="text-headline text-text-primary">Shop</h1>
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="container-organic inline-block px-12 py-10">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              className="mx-auto mb-4 text-text-muted/40"
            >
              <path
                d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6zM3 6h18M16 10a4 4 0 01-8 0"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-text-secondary text-lg mb-1">Shop coming soon</p>
            <p className="text-text-muted text-sm">
              Vinyl, merch, and more — stay tuned.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
