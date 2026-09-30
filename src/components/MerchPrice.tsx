import { discountedCents, isDiscountPercent } from "@/lib/merch/sale";

export default function MerchPrice({
  price, compareAtPrice, discountPercent = 0, currency = "USD", maxPrice = price, large = false,
}: {
  price: number;
  compareAtPrice?: number;
  discountPercent?: number;
  currency?: string;
  maxPrice?: number;
  large?: boolean;
}) {
  const hasRange = price !== maxPrice;
  const sale = compareAtPrice != null && compareAtPrice > price &&
    isDiscountPercent(discountPercent) && discountPercent > 0 &&
    discountedCents(Math.round(compareAtPrice * 100), discountPercent) === Math.round(price * 100);
  const money = (amount: number) => new Intl.NumberFormat("en-US", {
    style: "currency", currency,
  }).format(amount);

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-2">
      <span
        className={`inline-flex flex-wrap items-baseline gap-x-2.5 gap-y-1 font-[family-name:var(--font-mono)] ${large ? "text-2xl" : "text-sm"}`}
      >
        {sale && (
          <span className={`text-text-secondary ${large ? "text-lg" : "text-xs"}`}>
            <span className="sr-only">Original price </span>
            <s>{hasRange ? "From " : ""}{money(compareAtPrice!)}</s>
          </span>
        )}
        <span className={sale ? "font-semibold text-text-primary" : "text-blue-300"}>
          {sale && <span className="sr-only">Sale price </span>}
          {hasRange ? "From " : ""}{money(price)}
        </span>
      </span>
      {sale && (
        <span
          className="shrink-0 bg-red-300 text-bg-deep px-2.5 py-1 font-[family-name:var(--font-heading)] text-[11px] font-bold tracking-[0.04em] leading-tight"
          style={{ borderRadius: "var(--radius-pill-right)" }}
        >
          {discountPercent}% OFF
        </span>
      )}
    </span>
  );
}
