import { orderLabel, type MerchOrder } from "./types";

// Quote every field, preserve Unicode, and neutralize spreadsheet formulas.
function cell(value: unknown): string {
  let text = String(value ?? "");
  if ((!/^\+?[0-9 ()-]+$/.test(text) && /^[\s]*[=+@-]/.test(text)) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function pirateShipCsv(orders: MerchOrder[]): string {
  const headers = ["Order Number", "Name", "Email", "Phone", "Address Line 1", "Address Line 2",
    "City", "State", "Zip", "Country", "Items", "Order Total", "Currency"];
  const rows = orders.map((order) => {
    const a = order.shipping_address;
    return [orderLabel(order), order.customer_name, order.email, order.phone,
      a.line1, a.line2, a.city, a.state, a.postal_code, a.country,
      order.items.map((i) => `${i.quantity} x ${i.title}${i.variant_title === "Default Title" ? "" : ` / ${i.variant_title}`}${i.sku ? ` [${i.sku}]` : ""}`).join("; "),
      (order.total_cents / 100).toFixed(2), order.currency.toUpperCase()];
  });
  // One row per shipment, including multi-item orders. No invented weights.
  return "\uFEFF" + [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function canExport(order: MerchOrder): boolean {
  const a = order.shipping_address;
  return order.livemode && ["paid", "partially_refunded"].includes(order.payment_status) &&
    ["new", "exported"].includes(order.fulfillment_status) && !order.inventory_issue && !order.source_data?.review_needed &&
    !!(order.customer_name && a.line1 && a.city && a.postal_code && a.country &&
      (a.country !== "US" || a.state));
}
