"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import type { ShopifyProduct } from "@/lib/shopify";

export default function ProductDetail({ product }: { product: ShopifyProduct }) {
  const { addItem } = useCart();

  const images = product.images.edges.map((e) => e.node);
  const variants = product.variants.edges.map((e) => e.node);
  const hasVariants = variants.length > 1 || variants[0]?.title !== "Default Title";

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (variants[0]) {
      for (const opt of variants[0].selectedOptions) {
        initial[opt.name] = opt.value;
      }
    }
    return initial;
  });
  const [added, setAdded] = useState(false);

  const selectedVariant = variants.find((v) =>
    v.selectedOptions.every((opt) => selectedOptions[opt.name] === opt.value),
  ) || variants[0];

  const price = parseFloat(selectedVariant?.price.amount || "0");
  const isAvailable = selectedVariant?.availableForSale ?? false;

  function handleOptionChange(optionName: string, value: string) {
    setSelectedOptions((prev) => ({ ...prev, [optionName]: value }));
    setAdded(false);
  }

  function handleAddToCart() {
    if (!selectedVariant || !isAvailable) return;
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      handle: product.handle,
      title: product.title,
      variantTitle: selectedVariant.title,
      price,
      currency: selectedVariant.price.currencyCode,
      imageUrl: images[0]?.url || "",
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div>
      <Link
        href="/shop"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-blue-300 transition-colors mb-8"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Shop
      </Link>

      <div className="container-organic p-3 sm:p-4">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div>
            <div className="container-inset aspect-square relative overflow-hidden">
              {images[selectedImageIndex] ? (
                <img
                  src={images[selectedImageIndex].url}
                  alt={images[selectedImageIndex].altText || product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-muted text-2xl bg-bg-raised">
                  {product.title}
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 mt-3">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImageIndex(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      i === selectedImageIndex
                        ? "border-blue-300"
                        : "border-transparent hover:border-blue-300/30"
                    }`}
                  >
                    <img
                      src={img.url}
                      alt={img.altText || `${product.title} image ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex flex-col justify-between p-4 sm:p-6">
            <div>
              {product.productType && (
                <p className="text-label mb-3">{product.productType}</p>
              )}
              <h1 className="text-headline mb-2">{product.title}</h1>

              <p className="text-2xl text-blue-300 font-semibold mb-6">
                ${price.toFixed(2)}
              </p>

              {/* Variant Options */}
              {hasVariants && (
                <div className="space-y-4 mb-6">
                  {product.options.map((option) => (
                    <div key={option.name}>
                      <p className="text-sm text-text-secondary mb-2">
                        {option.name}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {option.values.map((value) => {
                          const isSelected = selectedOptions[option.name] === value;
                          const variantForOption = variants.find((v) =>
                            v.selectedOptions.every((opt) =>
                              opt.name === option.name
                                ? opt.value === value
                                : selectedOptions[opt.name] === opt.value,
                            ),
                          );
                          const available = variantForOption?.availableForSale ?? false;

                          return (
                            <button
                              key={value}
                              onClick={() => handleOptionChange(option.name, value)}
                              disabled={!available}
                              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                                isSelected
                                  ? "border-blue-300 bg-blue-300/10 text-blue-300"
                                  : available
                                    ? "border-blue-300/10 text-text-secondary hover:border-blue-300/30 hover:text-text-primary"
                                    : "border-blue-300/5 text-text-muted/50 line-through cursor-not-allowed"
                              }`}
                            >
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {product.description && (
                <div className="text-text-secondary text-sm leading-relaxed mb-6 pt-4 border-t border-blue-300/10">
                  {product.description}
                </div>
              )}
            </div>

            <div>
              <button
                onClick={handleAddToCart}
                disabled={!isAvailable}
                className={`w-full py-3 rounded-full font-semibold text-sm transition-colors ${
                  !isAvailable
                    ? "bg-bg-shelf text-text-muted cursor-not-allowed"
                    : added
                      ? "bg-green-500/20 text-green-400 border border-green-400/30"
                      : "bg-blue-300 text-bg-deep hover:bg-blue-200 hover:shadow-[0_0_20px_rgba(124,185,232,0.15)]"
                }`}
              >
                {!isAvailable
                  ? "Sold Out"
                  : added
                    ? "Added to Cart"
                    : "Add to Cart"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
