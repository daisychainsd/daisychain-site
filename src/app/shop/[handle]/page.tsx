import { notFound } from "next/navigation";
import { getProductByHandle, getProducts } from "@/lib/shopify";
import ProductDetail from "./ProductDetail";

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ handle: p.handle }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);

  if (!product) return notFound();

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 relative">
      <div className="blob w-[400px] h-[400px] bg-amber-300 top-[-100px] right-[-150px] animate-drift" />
      <ProductDetail product={product} />
    </div>
  );
}
