import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductByHandle } from "@/lib/merch/storefront";
import ProductDetail from "./ProductDetail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) return {};
  return { title: product.title };
}

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);

  if (!product) return notFound();

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 relative overflow-hidden">
      <div className="blob w-[400px] h-[400px] bg-amber-300 top-[-100px] right-[-150px] animate-drift" />
      <ProductDetail product={product} />
    </div>
  );
}
