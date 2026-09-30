import type { MerchProduct } from "./types";

export function discountedCents(regularCents: number, percent: number) {
  return Math.round(regularCents * (100 - percent) / 100);
}

export function isDiscountPercent(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 99;
}

// Every size must carry the same valid percentage. For a price range, compare
// the cheapest size with its own original price and label both values "From".
export function productCompareAtPrice(product: MerchProduct): number | undefined {
  const variants = product.variants.edges.map(({ node }) => node);
  const percent = product.discountPercent;
  if (!variants.length || !isDiscountPercent(percent) || percent === 0 || !variants.every(v =>
    v.compareAtPrice && Number(v.compareAtPrice.amount) > Number(v.price.amount) &&
    v.compareAtPrice.currencyCode === v.price.currencyCode &&
    discountedCents(Math.round(Number(v.compareAtPrice.amount) * 100), percent) === Math.round(Number(v.price.amount) * 100)
  )) return undefined;
  const cheapest = variants.reduce((a, b) => Number(a.price.amount) <= Number(b.price.amount) ? a : b);
  return Number(cheapest.compareAtPrice!.amount);
}
