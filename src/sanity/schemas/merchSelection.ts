import { defineField, defineType } from "sanity";
import { MerchProductInput, MerchProductPreview } from "../components/MerchProductInput";

export const merchSelection = defineType({
  name: "merchSelection", title: "Product selection", type: "object",
  fields: [
    defineField({ name: "manualSelection", title: "Choose products and their order", type: "boolean", initialValue: false,
      description: "Arrange the products below first, then turn this on. On: show only your list, in this order. An empty list hides this section. Off: automatic list. Homepage changes are live immediately; Shop changes require Publish." }),
    defineField({ name: "products", title: "Products in display order", type: "array",
      description: "Add products from Ops, then drag to reorder. Prices, discounts, photos and availability always come from Ops.",
      validation: rule => rule.custom(value => {
        const ids = (value ?? []).map(item => (item as { productId?: string }).productId).filter(Boolean);
        return new Set(ids).size === ids.length || "Choose each product only once.";
      }),
      of: [{ type: "object", name: "merchPlacement", title: "Product",
        fields: [defineField({ name: "productId", title: "Product", type: "string", components: { input: MerchProductInput }, validation: rule => rule.required() })],
        preview: { select: { title: "productId" } }, components: { preview: MerchProductPreview },
      }],
    }),
  ],
});

export const shopSettings = defineType({
  name: "shopSettings", title: "Shop", type: "document",
  fields: [defineField({ name: "merch", title: "Shop products", type: "merchSelection" })],
  preview: { prepare: () => ({ title: "Shop Settings" }) },
});
