export async function shopifyFetch<T>({
  query,
  variables = {},
}: {
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
  const storefrontAccessToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

  if (!domain || !storefrontAccessToken || storefrontAccessToken === "your_storefront_token") {
    throw new Error("Shopify not configured");
  }

  const res = await fetch(`https://${domain}/api/2024-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": storefrontAccessToken,
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`Shopify API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  if (json.errors) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join("\n"));
  }

  return json.data;
}

export interface ShopifyImage {
  url: string;
  altText: string | null;
  width: number;
  height: number;
}

export interface ShopifyVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  price: { amount: string; currencyCode: string };
  selectedOptions: { name: string; value: string }[];
}

export interface ShopifyProduct {
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
  images: { edges: { node: ShopifyImage }[] };
  variants: { edges: { node: ShopifyVariant }[] };
  options: { name: string; values: string[] }[];
}

const PRODUCT_FRAGMENT = `
  id
  title
  handle
  description
  descriptionHtml
  productType
  tags
  availableForSale
  priceRange {
    minVariantPrice { amount currencyCode }
    maxVariantPrice { amount currencyCode }
  }
  images(first: 10) {
    edges {
      node {
        url
        altText
        width
        height
      }
    }
  }
  variants(first: 50) {
    edges {
      node {
        id
        title
        availableForSale
        price { amount currencyCode }
        selectedOptions { name value }
      }
    }
  }
  options {
    name
    values
  }
`;

export async function getProducts(): Promise<ShopifyProduct[]> {
  try {
    const data = await shopifyFetch<{
      products: { edges: { node: ShopifyProduct }[] };
    }>({
      query: `{
        products(first: 50, sortKey: CREATED_AT, reverse: true) {
          edges { node { ${PRODUCT_FRAGMENT} } }
        }
      }`,
    });
    const products = data.products.edges.map((e) => e.node);
    console.log(`[Shopify] Fetched ${products.length} products`);
    return products;
  } catch (err) {
    console.error("[Shopify] getProducts error:", err);
    return [];
  }
}

/** A variant resolved from Shopify — the authoritative price/title/stock. */
export interface ResolvedVariant {
  id: string;
  title: string;
  productTitle: string;
  availableForSale: boolean;
  amount: number;
  imageUrl: string | null;
}

/**
 * Look up variants by id. Checkout MUST price from this, never from the
 * browser — the cart lives in localStorage and is trivially edited.
 * Returns only variants Shopify actually resolved; unknown ids are dropped so
 * the caller can reject the order.
 */
export async function getVariantsByIds(
  ids: string[],
): Promise<Map<string, ResolvedVariant>> {
  const out = new Map<string, ResolvedVariant>();
  if (ids.length === 0) return out;
  try {
    const data = await shopifyFetch<{
      nodes: ({
        id: string;
        title: string;
        availableForSale: boolean;
        price: { amount: string };
        image: { url: string } | null;
        product: { title: string; featuredImage: { url: string } | null };
      } | null)[];
    }>({
      query: `query GetVariants($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on ProductVariant {
            id
            title
            availableForSale
            price { amount }
            image { url }
            product { title featuredImage { url } }
          }
        }
      }`,
      variables: { ids },
    });
    for (const n of data.nodes ?? []) {
      if (!n?.id) continue;
      const amount = Number(n.price?.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      out.set(n.id, {
        id: n.id,
        title: n.title,
        productTitle: n.product?.title ?? n.title,
        availableForSale: n.availableForSale,
        amount,
        imageUrl: n.image?.url ?? n.product?.featuredImage?.url ?? null,
      });
    }
  } catch {
    return new Map();
  }
  return out;
}

export async function getProductByHandle(
  handle: string,
): Promise<ShopifyProduct | null> {
  try {
    const data = await shopifyFetch<{ product: ShopifyProduct | null }>({
      query: `query GetProduct($handle: String!) {
        product(handle: $handle) { ${PRODUCT_FRAGMENT} }
      }`,
      variables: { handle },
    });
    return data.product;
  } catch {
    return null;
  }
}
