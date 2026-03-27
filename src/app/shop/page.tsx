import { getProducts } from "@/lib/shopify";
import Image from "next/image";

export default async function ShopPage() {
  let products: any[] = [];
  try {
    const data = await getProducts();
    products = data.products.edges.map((e: any) => e.node);
  } catch {
    // Shopify not configured yet
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 relative">
      {/* Decorative blob — amber tint for shop */}
      <div className="blob w-[400px] h-[400px] bg-amber-300 top-[-100px] right-[-150px] animate-drift" />

      <div className="mb-10">
        <p className="text-label mb-2">Merch</p>
        <h1 className="text-headline text-text-primary">Shop</h1>
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8">
          {products.map((product: any) => {
            const image = product.images.edges[0]?.node;
            const price = product.priceRange.minVariantPrice;
            return (
              <div key={product.id} className="group">
                <div className="container-organic-md p-2 hover-lift">
                  <div className="container-inset-md aspect-square relative overflow-hidden">
                    {image && (
                      <Image
                        src={image.url}
                        alt={image.altText || product.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      />
                    )}
                  </div>
                  <div className="px-2 pt-3 pb-2">
                    <p className="text-text-primary font-medium text-sm truncate">
                      {product.title}
                    </p>
                    <p className="text-text-secondary text-sm">
                      ${parseFloat(price.amount).toFixed(2)}{" "}
                      {price.currencyCode}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 text-text-muted">
          <p className="text-2xl mb-2">Shop coming soon</p>
          <p className="text-sm">
            Connect your Shopify store to display products here.
          </p>
        </div>
      )}
    </div>
  );
}
