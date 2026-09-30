"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CatalogProduct } from "@/lib/merch/types";
import { thumbnailStyle } from "@/lib/merch/thumbnail";
import styles from "./MerchDashboard.module.css";

type Adjustment = { id: string; variant_id: string; quantity_delta: number; reason: string; created_at: string };
type Change = { variantId: string; delta: number; reason: string; requestId: string };

export function ProductThumbnail({ product }: { product: CatalogProduct }) {
  const [failed, setFailed] = useState(false);
  const image = product.images[0];
  return <span className={styles.productImage}>{image && !failed
    ? <img src={image.url} alt={image.altText || product.title} loading="lazy" style={thumbnailStyle(image.thumbnailCrop)} onError={() => setFailed(true)} />
    : <span className={styles.noImage}>No image yet</span>}</span>;
}

export default function ProductInventory({ product, adjustments, edit, lock, stockSaved, refresh }: {
  product: CatalogProduct;
  adjustments: Adjustment[];
  edit: () => void;
  lock: (locked: boolean) => void;
  stockSaved: (variantId: string, stock: number) => void;
  refresh: () => Promise<void>;
}) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("Opening stock count");
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pending = useRef<Change[]>([]);
  const variants = [...product.merch_variants].sort((a, b) => a.sort_order - b.sort_order);
  const dirty = Object.values(quantities).some(q => q !== "" && Number(q) !== 0);
  const locked = saving || uncertain;

  useEffect(() => { lock(dirty || locked); }, [dirty, locked, lock]);

  useEffect(() => {
    if (!dirty && !locked) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, locked]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError(""); setMessage("");
    if (!uncertain) {
      pending.current = variants.filter(v => Number(quantities[v.id])).map(v => ({ variantId: v.id, delta: Number(quantities[v.id]), reason: reason.trim(), requestId: crypto.randomUUID() }));
    }
    if (!pending.current.length) return;
    setSaving(true); lock(true);
    let unknown = false;
    let saved = 0;
    try {
      while (pending.current.length) {
        const change = pending.current[0];
        // Keep the exact request on an unknown response so a retry cannot double-add stock.
        unknown = true;
        const response = await fetch("/api/ops/merch/inventory", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change),
        });
        const result = await response.json();
        if (!response.ok) {
          unknown = response.status >= 500;
          throw new Error(result.error || "Could not save this size.");
        }
        if (!Number.isSafeInteger(result.stock)) throw new Error("The save response was incomplete.");
        unknown = false;
        stockSaved(change.variantId, result.stock);
        setQuantities(q => ({ ...q, [change.variantId]: "" }));
        pending.current.shift(); saved++;
      }
      setMessage(`Stock saved for ${saved} ${saved === 1 ? "size / option" : "sizes / options"}.`);
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Connection interrupted.";
      setError(`${saved ? `${saved} saved. ` : ""}${detail} ${unknown ? "Retry remaining changes to confirm the save safely." : "Saved sizes are cleared. Check the remaining quantities and save again."}`);
    } finally {
      setUncertain(unknown); setSaving(false); lock(unknown);
    }
    // Refresh failures must never put confirmed adjustments back into the save queue.
    if (!unknown) {
      try { await refresh(); }
      catch { setMessage("Saved quantities are shown. Recent activity could not refresh; use Refresh to try again."); }
    }
  }

  return <section>
    <div className={styles.productHeading}>
      <div className={styles.productHeadingImage}><ProductThumbnail product={product} /></div>
      <div><p className={styles.eyebrow}>{product.active ? "Product inventory" : "Hidden product"}</p><h2 className={styles.productTitle}>{product.title}</h2><p className={styles.productSummary}>{variants.length} sizes / options · {variants.reduce((sum, v) => sum + v.stock, 0)} in stock</p></div>
      <button className={styles.button} disabled={locked || dirty} onClick={edit}>Edit product & sizes</button>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {message && <p role="status" className={styles.message}>{message}</p>}
    {variants.length ? <form onSubmit={save} className={styles.inventoryPanel}>
      <div className={styles.inventoryIntro}><h3>Stock by size</h3><p>Enter units to add or remove for each size. Use a minus sign for sales or corrections. Leave unchanged sizes blank.</p></div>
      <div className={styles.stockTable}>
        <div className={styles.stockTableHead} aria-hidden="true"><span>Size / option</span><span>In stock</span><span>Add / remove</span><span>After change</span></div>
        {variants.map(v => {
          const delta = Number(quantities[v.id] || 0);
          return <div className={styles.stockRow} key={v.id}>
            <div className={styles.sizeName}><strong>{v.title}</strong><span>{new Intl.NumberFormat("en-US", { style: "currency", currency: v.currency }).format(v.price_cents / 100)}{v.sku ? ` · ${v.sku}` : ""}{!v.active ? " · Hidden size" : ""}</span></div>
            <div className={styles.stockNumber}><span className={styles.mobileLabel}>In stock</span>{v.stock}</div>
            <label className={styles.quantityInput}><span className={styles.mobileLabel}>Add / remove</span><span className="sr-only">Quantity change for {v.title}</span><input className={styles.input} type="number" step="1" min={Math.max(-100000, -v.stock)} max="100000" placeholder="0" value={quantities[v.id] ?? ""} disabled={locked} onChange={e => { setQuantities(q => ({ ...q, [v.id]: e.target.value })); setMessage(""); }} /></label>
            <output className={`${styles.stockNumber} ${styles.stockAfter}`} aria-label={`Stock after change for ${v.title}`}><span className={styles.mobileLabel}>After change</span>{Number.isFinite(delta) ? v.stock + delta : "—"}</output>
          </div>;
        })}
      </div>
      <div className={styles.inventorySave}>
        <label>Reason<input required maxLength={300} className={styles.input} value={reason} disabled={locked} onChange={e => setReason(e.target.value)} /></label>
        {dirty && !uncertain && <button type="button" className={styles.button} disabled={saving} onClick={() => { setQuantities({}); setError(""); }}>Clear changes</button>}
        <button className={`${styles.button} ${styles.primary}`} disabled={saving || (!dirty && !uncertain)}>{saving ? "Saving…" : uncertain ? "Retry remaining changes" : "Save stock changes"}</button>
      </div>
    </form> : <div className={styles.empty}><h3>Add sizes to get started</h3><p>This product has no sizes or options yet.</p><button className={`${styles.button} ${styles.primary}`} onClick={edit}>Add sizes / options</button></div>}
    {!!adjustments.length && <details className={styles.productHistory}><summary>Recent stock changes</summary>{adjustments.map(a => <div key={a.id}><strong>{a.quantity_delta > 0 ? "+" : ""}{a.quantity_delta} · {variants.find(v => v.id === a.variant_id)?.title}</strong><span>{a.reason}</span><span>{new Date(a.created_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} PT</span></div>)}</details>}
  </section>;
}
