const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const adminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

async function adminFetch<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!domain || !adminToken || adminToken === "your_admin_access_token") {
    throw new Error("Shopify Admin API not configured");
  }

  const res = await fetch(`https://${domain}/admin/api/2024-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": adminToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join("\n"));
  }
  return json.data;
}

interface ShippingAddress {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

interface OrderLineItem {
  variantId: string;
  quantity: number;
}

export async function createDraftOrder(
  address: ShippingAddress,
  lineItems: OrderLineItem[],
  customerEmail?: string,
) {
  const gqlLineItems = lineItems.map((item) => ({
    variantId: item.variantId,
    quantity: item.quantity,
  }));

  const shippingAddress = {
    address1: address.line1 || "",
    address2: address.line2 || "",
    city: address.city || "",
    province: address.state || "",
    zip: address.postal_code || "",
    country: address.country || "US",
    firstName: address.name?.split(" ")[0] || "",
    lastName: address.name?.split(" ").slice(1).join(" ") || "",
  };

  const mutation = `
    mutation CreateDraftOrder($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          name
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const input: Record<string, unknown> = {
    lineItems: gqlLineItems,
    shippingAddress,
    note: "Auto-created from website checkout (Stripe)",
  };

  if (customerEmail) {
    input.email = customerEmail;
  }

  const data = await adminFetch<{
    draftOrderCreate: {
      draftOrder: { id: string; name: string } | null;
      userErrors: { field: string; message: string }[];
    };
  }>(mutation, { input });

  if (data.draftOrderCreate.userErrors.length > 0) {
    const errors = data.draftOrderCreate.userErrors
      .map((e) => `${e.field}: ${e.message}`)
      .join(", ");
    throw new Error(`Shopify draft order errors: ${errors}`);
  }

  return data.draftOrderCreate.draftOrder;
}
