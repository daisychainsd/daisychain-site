import { getProducts } from "@/lib/merch/storefront";

// Only public storefront fields. No stock counts, SKUs or admin credentials.
export async function GET() {
  try {
    const products = await getProducts();
    return Response.json({ products: products.map(p => ({
      id: p.id, title: p.title, handle: p.handle, available: p.availableForSale,
      imageUrl: p.images.edges[0]?.node.url ?? null,
      price: p.priceRange.minVariantPrice,
    })) }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=30" } });
  } catch {
    return Response.json({ error: "Could not load products. Try again." }, { status: 503 });
  }
}
