"use client";

import { useEffect, useState } from "react";
import { set, unset, type StringInputProps, type PreviewProps } from "sanity";

interface ProductChoice {
  id: string; title: string; handle: string; available: boolean; imageUrl: string | null;
  price: { amount: string; currencyCode: string };
}

let cached: Promise<ProductChoice[]> | undefined;
let expires = 0;
function loadProducts() {
  if (!cached || Date.now() >= expires) {
    expires = Date.now() + 30_000;
    cached = fetch("/api/merch-products", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Could not load products from Ops.");
      return (await response.json()).products as ProductChoice[];
    }).catch(error => { cached = undefined; throw error; });
  }
  return cached;
}

function useProducts() {
  const [products, setProducts] = useState<ProductChoice[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const refresh = () => { loadProducts().then(data => {
      if (active) { setProducts(data); setError(""); setLoading(false); }
    }).catch(() => { if (active) { setError("Could not load products from Ops. Your saved selection is preserved; this list will retry automatically."); setLoading(false); } }); };
    refresh();
    const timer = setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  return { products, error, loading };
}

export function MerchProductInput({ value, onChange, elementProps, readOnly }: StringInputProps) {
  const { products, error, loading } = useProducts();
  const selected = products.find(p => p.id === value);
  const availableProducts = products.filter(p => p.available);
  // The string input ref is specific to <input>; preserve the focus handlers on this select.
  const focusProps = { id: elementProps.id, onFocus: elementProps.onFocus, onBlur: elementProps.onBlur,
    "aria-describedby": elementProps["aria-describedby"] };
  return <div style={{ display: "grid", gap: 12 }}>
    <select {...focusProps} value={value ?? ""} disabled={readOnly} onChange={e => onChange(e.target.value ? set(e.target.value) : unset())}
      style={{ width: "100%", padding: 12, background: "var(--color-bg-surface)", color: "var(--color-text-primary)", border: "1px solid var(--color-text-muted)", borderRadius: "var(--radius-organic-sm)" }}>
      <option value="">Choose a product</option>
      {value && !selected && <option value={value}>{loading ? "Loading selected product…" : error ? "Saved product — Ops unavailable" : "Unavailable product — hidden or removed in Ops"}</option>}
      {selected && !selected.available && <option value={selected.id} disabled>{selected.title} (sold out — replace or remove)</option>}
      {availableProducts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
    </select>
    {error && <p role="alert">{error}</p>}
    {selected && <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {selected.imageUrl && <img src={selected.imageUrl} alt="" width={64} height={64} style={{ objectFit: "contain" }} />}
      <div><strong>{selected.title}</strong><p>{new Intl.NumberFormat("en-US", { style: "currency", currency: selected.price.currencyCode }).format(Number(selected.price.amount))}{selected.available ? "" : " · Sold out"}</p></div>
    </div>}
    {!loading && !error && availableProducts.length === 0 && <p>No published products are currently in stock. Restock or publish a product in Ops to select it here.</p>}
    <p style={{ fontSize: 13, opacity: 0.75 }}>Only published products with stock can be selected. Details update from Ops automatically. Previously selected products that sell out stay marked so you can replace or remove them.</p>
  </div>;
}

export function MerchProductPreview(props: PreviewProps) {
  const { products, error, loading } = useProducts();
  const product = products.find(p => p.id === props.title);
  return props.renderDefault({ ...props,
    title: product?.title ?? (props.title ? loading ? "Loading product…" : error ? "Saved product" : "Unavailable product" : "Choose a product"),
    subtitle: error || (loading ? "Loading details from Ops" : product ? (product.available ? "From Ops" : "Sold out") : "Hidden or removed products are skipped on the site"),
    media: product?.imageUrl ? <img src={product.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : undefined,
  });
}
