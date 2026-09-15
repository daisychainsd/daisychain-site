export interface MerchImage {
  url: string;
  altText: string | null;
  width: number;
  height: number;
}

export interface MerchVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  price: { amount: string; currencyCode: string };
  selectedOptions: { name: string; value: string }[];
}

// Keep the existing storefront component contract when changing catalog storage.
export interface MerchProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  descriptionHtml: string;
  productType: string;
  tags: string[];
  availableForSale: boolean;
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
  images: { edges: { node: MerchImage }[] };
  variants: { edges: { node: MerchVariant }[] };
  options: { name: string; values: string[] }[];
}

export interface InventoryVariant {
  id: string;
  product_id: string;
  title: string;
  sku: string;
  price_cents: number;
  currency: string;
  stock: number;
  sort_order: number;
  active: boolean;
  selected_options: { name: string; value: string }[];
}

export interface CatalogProduct {
  id: string;
  handle: string;
  title: string;
  description: string;
  product_type: string;
  active: boolean;
  images: MerchImage[];
  options: { name: string; values: string[] }[];
  tags: string[];
  merch_variants: InventoryVariant[];
}

export interface OrderItem {
  variant_id: string | null;
  title: string;
  variant_title: string;
  sku: string;
  quantity: number;
  unit_price_cents: number;
}

export interface MerchOrder {
  id: string;
  order_number: number;
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  livemode: boolean;
  email: string;
  customer_name: string;
  phone: string;
  shipping_address: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  };
  items: OrderItem[];
  currency: string;
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  payment_status: "paid" | "partially_refunded" | "refunded" | "disputed";
  fulfillment_status: "new" | "exported" | "shipped" | "on_hold";
  inventory_issue: boolean;
  exported_at: string | null;
  shipped_at: string | null;
  tracking_number: string | null;
  notes: string;
  confirmation_email_sent_at: string | null;
  created_at: string;
}

export function orderLabel(order: Pick<MerchOrder, "order_number">) {
  return `DC-${String(order.order_number).padStart(5, "0")}`;
}
