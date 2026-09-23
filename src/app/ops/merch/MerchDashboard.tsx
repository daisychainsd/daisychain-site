"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import styles from "./MerchDashboard.module.css";
import { canExport } from "@/lib/merch/csv";
import { orderLabel, type CatalogProduct, type MerchOrder } from "@/lib/merch/types";

const input = styles.input;
const button = styles.button;
const primary = `${styles.button} ${styles.primary}`;
type Adjustment = { id: string; variant_id: string; quantity_delta: number; reason: string; created_at: string };
type Data = { orders: MerchOrder[]; products: CatalogProduct[]; adjustments: Adjustment[]; newOrders: number };
const money = (cents: number, currency = "usd") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
const date = (value: string) => new Date(value).toLocaleString("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function MerchDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState("orders");
  const [status, setStatus] = useState("unshipped");
  const [source, setSource] = useState("all");
  const [test, setTest] = useState(false);
  const [page, setPage] = useState(0);
  const [selection, setSelection] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const retryKeys = useRef(new Map<string, string>());
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/ops/merch?status=${status}&test=${test}&page=${page}&source=${source}`, { signal, cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Could not load merch");
    setData(body); setSelection([]);
  }, [status, test, page, source]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [load]);

  async function action(path: string, body: object, csv = false) {
    setBusy(true); setError(""); setMessage("");
    const fingerprint = `${path}:${JSON.stringify(body)}`;
    const requestId = retryKeys.current.get(fingerprint) ?? crypto.randomUUID();
    retryKeys.current.set(fingerprint, requestId);
    try {
      const response = await fetch(`/api/ops/merch/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, requestId }) });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error); }
      // A confirmed save is complete. Only an unknown POST outcome is retryable.
      retryKeys.current.delete(fingerprint);
      let downloaded = false;
      if (csv) {
        try {
          const url = URL.createObjectURL(await response.blob());
          const a = document.createElement("a"); a.href = url; a.download = `daisy-chain-shipping-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
          downloaded = true;
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch { setError("Orders were marked exported, but the download failed. Refresh and use Re-export selected to download again."); }
      }
      try { await load(); }
      catch { setMessage(csv ? "Export saved, but the list did not refresh. Click Refresh to see the current orders." : "Saved, but the list did not refresh. Click Refresh to see the current values."); return true; }
      setMessage(csv ? downloaded ? "CSV downloaded. Import it into Pirate Ship to create labels. Orders are marked exported, ready to pack." : "Export saved. Use Re-export selected to download the CSV again." : "Saved.");
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Request failed. Retry safely."); return false; }
    finally { setBusy(false); }
  }

  const variants = data?.products.flatMap((p) => p.merch_variants.map((v) => ({ ...v, productTitle: p.title }))) ?? [];
  const eligible = data?.orders.filter(canExport) ?? [];
  const filterStatus = (value: string) => { setStatus(value); setPage(0); setSelection([]); };
  const selectedExported = data?.orders.some(o => selection.includes(o.id) && o.exported_at);
  const statusTitle = status === "unshipped" ? "To ship" : status === "shipped" ? "Shipped orders" : status === "all" ? "All orders" : status === "on_hold" ? "Needs review" : status === "exported" ? "Ready to pack" : "New orders";
  return <div className={`${styles.shell} max-w-7xl mx-auto px-6`}>
    <Link href="/ops" className={styles.back}><Icon name="back" />Ops</Link>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Daisy Chain / Fulfillment</p><h1 className={styles.title}>Merch</h1></div>
      <button className={button} disabled={busy} onClick={() => { setError(""); load().catch((e) => setError(e.message)); }}><Icon name="refresh" />Refresh</button>
    </header>
    <nav className={styles.navigation} aria-label="Merch sections">
      {["orders", "inventory", "products"].map(t => <button key={t} aria-current={tab === t ? "page" : undefined} onClick={() => { setTab(t); setSelection([]); }}>{t[0].toUpperCase() + t.slice(1)}</button>)}
    </nav>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {message && <p role="status" className={styles.message}>{message}</p>}
    {!data && <div className={styles.empty}><Icon name="package" /><p>{error ? "Orders could not be loaded." : "Loading merch…"}</p></div>}
    {data && tab === "orders" && <>
      <div className={styles.toolbar}>
        <div className={styles.segments} role="group" aria-label="Order status">
          {[['unshipped', 'Unshipped'], ['shipped', 'Shipped'], ['all', 'All orders']].map(([value, label]) => <button key={value} aria-pressed={status === value} disabled={busy} onClick={() => filterStatus(value)}>{label}</button>)}
        </div>
        <div className={styles.filters}>
          <div className={styles.selectControl}>
            <select aria-label="Source" value={source} disabled={busy} onChange={e => { setSource(e.target.value); setPage(0); setSelection([]); }}>
              <option value="all">All sources</option><option value="website">Website</option><option value="bandcamp">Bandcamp</option>
            </select><Icon name="chevron" />
          </div>
          <details className={styles.options}>
            <summary className={button}><Icon name="filter" />Filters</summary>
            <div className={styles.optionsPanel}>
              <label>Order status<div className={styles.selectControl}><select aria-label="Detailed status" disabled={busy} value={status} onChange={e => filterStatus(e.target.value)}>
                <option value="unshipped">Unshipped</option><option value="on_hold">On hold</option><option value="new">New</option><option value="exported">Exported</option><option value="shipped">Shipped</option><option value="all">All orders</option>
              </select><Icon name="chevron" /></div></label>
              <label className={styles.checkLabel}><input type="checkbox" disabled={busy} checked={test} onChange={e => { setTest(e.target.checked); setPage(0); setSelection([]); }} />Test orders</label>
            </div>
          </details>
        </div>
      </div>
      <div className={styles.queueHeading}>
        <div><h2>{statusTitle}</h2><span className={styles.count}>{data.orders.length}{data.orders.length === 50 ? "+" : ""}</span>{test && <span className={styles.badge}>Test mode</span>}</div>
        {!!eligible.length && <button className={styles.textButton} disabled={busy} onClick={() => setSelection(selection.length === eligible.length ? [] : eligible.map(o => o.id))}>{selection.length === eligible.length ? "Clear selection" : "Select eligible"}</button>}
      </div>
      <div className={styles.orderList}>{data.orders.map(order => <OrderCard key={order.id} order={order} selected={selection.includes(order.id)} busy={busy}
        select={() => setSelection(ids => ids.includes(order.id) ? ids.filter(id => id !== order.id) : [...ids, order.id])}
        save={body => action("order", body)} review={body => action("bandcamp-review", body)} />)}</div>
      {!data.orders.length && <div className={styles.empty}>
        <div className={styles.emptyIcon}><Icon name="package" /></div>
        <h3>{status === "unshipped" ? "Nothing waiting to ship" : "No orders in this view"}</h3>
        <button className={button} onClick={() => filterStatus(status === "unshipped" ? "shipped" : "all")}>{status === "unshipped" ? "View shipped orders" : "View all orders"}</button>
      </div>}
      {!!selection.length && <div className={styles.selectionBar} role="region" aria-label="Selected order actions">
        <span><strong>{selection.length}</strong> selected</span>
        <button className={styles.textButton} disabled={busy} onClick={() => setSelection([])}>Clear</button>
        <button className={primary} disabled={busy || test} onClick={() => action("export", { ids: selection, reexport: !!selectedExported }, true)}><Icon name="download" />{selectedExported ? "Re-export selected" : `Export CSV (${selection.length})`}</button>
      </div>}
      {(page > 0 || data.orders.length === 50) && <div className={styles.pagination}><button className={button} disabled={!page || busy} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1}</span><button className={button} disabled={data.orders.length < 50 || busy} onClick={() => setPage(page + 1)}>Next</button></div>}
    </>}
    {data && tab === "inventory" && <>
      <section className="container-organic p-6 mb-6">
        <h2 className="uppercase text-title mb-3">Adjust inventory</h2>
        <p className="text-text-secondary text-sm mb-5">Record a restock, return, booth sale or count correction.</p>
        <form className="grid md:grid-cols-4 gap-4 items-end" onSubmit={async (e) => {
          e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
          if (await action("inventory", { variantId: f.get("variantId"), delta: Number(f.get("delta")), reason: f.get("reason") })) form.reset();
        }}>
          <label className="text-sm md:col-span-2">Item<div className={styles.selectControl}><select required name="variantId" aria-label="Item">{variants.map((v) => <option key={v.id} value={v.id}>{v.productTitle} / {v.title} ({v.stock})</option>)}</select><Icon name="chevron" /></div></label>
          <label className="text-sm">Quantity change<input required name="delta" type="number" step="1" min="-100000" max="100000" placeholder="−3 or +10" className={input} /></label>
          <label className="text-sm md:col-span-3">Reason<input required name="reason" maxLength={300} placeholder="Booth sales — show/date, restock, or count correction" className={input} /></label>
          <button className={primary} disabled={busy || !variants.length}>Save adjustment</button>
        </form>
      </section>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">{variants.map((v) => <div key={v.id} className="container-organic p-5 min-w-0"><p className="font-semibold m-0">{v.productTitle}</p><p className="text-text-secondary text-sm">{v.title} · {v.sku || "No SKU"}</p><p className={`font-mono text-2xl m-0 ${v.stock <= 0 ? "text-red-400" : "text-blue-300"}`}>{v.stock} <span className="text-sm">remaining</span></p>{!v.active && <span className="text-text-secondary text-xs">Hidden variant</span>}</div>)}</div>
      <section className="container-organic p-6"><h2 className="uppercase text-title mb-4">Recent adjustments</h2>{data.adjustments.map((a) => <div key={a.id} className="border-t border-white/[0.06] py-3 flex flex-wrap gap-x-4 gap-y-1 text-sm"><span className="font-mono text-blue-300">{a.quantity_delta > 0 ? "+" : ""}{a.quantity_delta}</span><span>{variants.find((v) => v.id === a.variant_id)?.productTitle} / {variants.find((v) => v.id === a.variant_id)?.title}</span><span className="text-text-secondary">{a.reason}</span><span className="font-mono text-text-secondary ml-auto">{date(a.created_at)} PT</span></div>)}{!data.adjustments.length && <p className="text-text-secondary">No adjustments yet.</p>}</section>
    </>}
    {data && tab === "products" && <>
      <button className={`${primary} mb-5`} disabled={busy} onClick={() => setEditing({ id: `merch-product-${crypto.randomUUID()}`, handle: "", title: "", description: "", product_type: "", active: false, images: [], options: [], tags: [], merch_variants: [] })}>Add product</button>
      {editing && <ProductEditor key={editing.id} product={editing} busy={busy} close={() => setEditing(null)} save={async (product) => { if (await action("product", product)) setEditing(null); }} />}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{data.products.map((p) => <div key={p.id} className="container-organic p-5 min-w-0">{p.images[0] && <img src={p.images[0].url} alt={p.title} className="container-inset-md w-full aspect-square object-cover mb-4" />}<h2 className="uppercase text-lg">{p.title}</h2><p className="text-text-secondary text-sm">{p.active ? "Published" : "Hidden"} · {p.merch_variants.length} variants</p><button className={button} onClick={() => setEditing(p)}>Edit product</button></div>)}</div>
    </>}
  </div>;
}

function Icon({ name }: { name: "back" | "refresh" | "chevron" | "filter" | "download" | "check" | "package" }) {
  const paths = { back: "M10 4 4 10l6 6M4 10h12", refresh: "M16 8a6 6 0 1 0 .2 4M16 3v5h-5", chevron: "m5 7 5 5 5-5", filter: "M3 5h14M6 10h8M8 15h4", download: "M10 3v10m-4-4 4 4 4-4M4 14v3h12v-3", check: "m4 10 4 4 8-8", package: "m3 6 7-3 7 3v9l-7 3-7-3V6Zm0 0 7 3 7-3M10 9v9M6.5 4.5l7 3" };
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

function OrderCard({ order: o, selected, select, save, review, busy }: { order: MerchOrder; selected: boolean; select: () => void; busy: boolean; save: (body: object) => Promise<boolean>; review: (body: object) => Promise<boolean> }) {
  const a = o.shipping_address;
  const statusLabel = { new: "Unshipped", exported: "Exported", shipped: "Shipped", on_hold: "On hold" }[o.fulfillment_status];
  const blocked = !o.livemode || o.inventory_issue || o.source_data?.review_needed || ["refunded", "disputed", "pending", "failed"].includes(o.payment_status);
  return <article className={`${styles.orderCard} ${selected ? styles.selected : ""}`}>
    <header className={styles.orderHeader}>
      <div className={styles.orderIdentity}>
        <input type="checkbox" checked={selected} disabled={!canExport(o) || busy} onChange={select} aria-label={`Select ${orderLabel(o)}`} />
        <span className={styles.orderReference}>{orderLabel(o)}</span>
        <span className={styles.source}>{o.source === "bandcamp" ? "Bandcamp" : "Website"}</span>
        <span className={`${styles.badge} ${o.fulfillment_status === "on_hold" ? styles.hold : ""}`}>{statusLabel}</span>
      </div>
      <time className={styles.date} dateTime={o.created_at}>{date(o.created_at)} PT</time>
    </header>
    <div className={styles.orderBody}>
      <section className={styles.recipient} aria-label="Shipping address">
        <h3>{o.customer_name || "Missing recipient name"}</h3>
        <p className={styles.contact}>{o.email}</p>
        <address>{a.line1 || "Missing shipping address"}{a.line2 && <><br />{a.line2}</>}<br />{[a.city, a.state, a.postal_code].filter(Boolean).join(", ")}<br />{a.country}{o.phone && <><br />{o.phone}</>}</address>
      </section>
      <section className={styles.items} aria-label="Order items">
        {o.items.map((item, index) => <div key={index} className={styles.item}>
          <span className={styles.quantity}>{item.quantity}×</span>
          <div><p className={styles.itemTitle}>{item.title}</p><p className={styles.itemMeta}>{[item.variant_title !== "Default Title" ? item.variant_title : "", item.sku].filter(Boolean).join(" · ")}</p></div>
          <span className={styles.itemPrice}>{money(item.line_total_cents ?? item.quantity * item.unit_price_cents, o.currency)}</span>
        </div>)}
      </section>
    </div>
    {o.source_data?.review_needed && <div className={styles.orderWarning}>Bandcamp details changed. Review the update before shipping.</div>}
    {o.inventory_issue && <div className={styles.orderWarning}>Inventory needs review before this order can ship.</div>}
    {["refunded", "disputed", "pending", "failed"].includes(o.payment_status) && <div className={styles.orderWarning}>{o.payment_status.replaceAll("_", " ")} payment — shipping is blocked.</div>}
    {o.exported_at && o.fulfillment_status !== "shipped" && <div className={styles.orderWarning}>Already exported. Check the existing Pirate Ship label before buying another.</div>}
    {o.source_data?.review_needed && o.source_data.pending && <details className={styles.review}>
      <summary>Review updated Bandcamp details<Icon name="chevron" /></summary>
      <div className={styles.reviewBody}><strong>{o.source_data.pending.customer_name}</strong><p>{o.source_data.pending.email} {o.source_data.pending.phone}</p><p>{Object.values(o.source_data.pending.shipping_address).filter(Boolean).join(", ")}</p>
        <ul>{o.source_data.pending.items.map((item, n) => <li key={n}>{item.quantity} × {item.title} / {item.variant_title}</li>)}</ul>
        <p>Total: {money(o.source_data.pending.total_cents, o.source_data.pending.currency)}</p>
        <p>Check these changes against the saved order and any existing label. Accepting keeps unshipped orders on hold.</p>
        <form className={styles.reviewForm} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); review({ id: o.id, note: f.get("reviewNote"), snapshot: o.source_data?.pending }); }}>
          <label>Review note<input className={input} name="reviewNote" required maxLength={500} /></label>
          <button className={button} disabled={busy}>Accept updated Bandcamp details</button>
        </form>
      </div>
    </details>}
    <footer className={styles.orderFooter}>
      <div className={styles.total}><strong>{money(o.total_cents, o.currency)}</strong><span>{o.payment_status.replaceAll("_", " ")}</span></div>
      <button className={o.fulfillment_status === "shipped" ? button : primary} disabled={busy || blocked}
        onClick={() => save({ id: o.id, status: o.fulfillment_status === "shipped" ? (o.exported_at ? "on_hold" : "new") : "shipped", tracking: o.tracking_number ?? "", notes: o.notes, resolveStock: false })}>
        {o.fulfillment_status !== "shipped" && <Icon name="check" />}{o.fulfillment_status === "shipped" ? "Mark unshipped" : "Mark shipped"}
      </button>
    </footer>
    <details className={styles.fulfillment} key={`${o.fulfillment_status}:${o.tracking_number}:${o.notes}`}>
      <summary><span>Fulfillment and notes{o.notes && <span className={styles.noteDot} aria-label="Has saved notes" />}</span><Icon name="chevron" /></summary>
      <div className={styles.fulfillmentBody}>
        <div className={styles.metadata}>
          <span>Shipping {money(o.shipping_cents, o.currency)}</span><span>Tax {money(o.tax_cents, o.currency)}</span>{!!o.discount_cents && <span>Discount {money(o.discount_cents, o.currency)}</span>}
          {o.source === "bandcamp" && <span>Bandcamp order {o.source_data?.payment_id ?? o.source_order_id?.split(":").at(-1)}</span>}
          {o.exported_at && <span>Exported {date(o.exported_at)} PT</span>}{o.shipped_at && <span>Shipped {date(o.shipped_at)} PT</span>}
        </div>
        <form className={styles.fulfillmentForm} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); save({ id: o.id, status: f.get("status"), tracking: f.get("tracking"), notes: f.get("notes"), resolveStock: f.get("resolveStock") === "on" }); }}>
          <label>Status<div className={styles.selectControl}><select name="status" defaultValue={o.fulfillment_status} aria-label={`Status for ${orderLabel(o)}`}><option value="new">Unshipped</option>{o.fulfillment_status === "exported" && <option value="exported">Exported</option>}<option value="on_hold">On hold</option><option value="shipped">Shipped</option></select><Icon name="chevron" /></div></label>
          <label><span>Tracking number <span className={styles.optional}>optional</span></span><input name="tracking" defaultValue={o.tracking_number ?? ""} maxLength={200} className={input} /></label>
          <label className={styles.fullWidth}>Internal notes<textarea name="notes" defaultValue={o.notes} maxLength={2000} rows={3} className={input} /></label>
          {o.inventory_issue && <label className={styles.checkLabel}><input type="checkbox" name="resolveStock" />Inventory issue resolved</label>}
          <button className={button} disabled={busy}>Save fulfillment</button>
        </form>
        <p className={styles.receipt}>{o.source === "bandcamp" ? "Purchase receipt is handled by Bandcamp." : `Confirmation email: ${o.confirmation_email_sent_at ? `sent ${date(o.confirmation_email_sent_at)}` : "not recorded as sent"}.`}</p>
      </div>
    </details>
  </article>;
}

function ProductEditor({ product, save, close, busy }: { product: CatalogProduct; save: (p: CatalogProduct) => Promise<void>; close: () => void; busy: boolean }) {
  const [p, setP] = useState(() => structuredClone(product));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  async function upload(e: FormEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0]; if (!file) return;
    if (file.size > 4_000_000) { setError("Choose a JPG, PNG or WebP under 4 MB"); return; }
    setUploading(true); setError("");
    try {
      const form = new FormData(); form.set("image", file);
      const response = await fetch("/api/ops/merch/image", { method: "POST", body: form });
      const body = await response.json().catch(() => ({ error: "Upload failed. Choose an image under 4 MB and try again." }));
      if (!response.ok || !body.url) throw new Error(body.error || "Upload failed");
      setP((p) => ({ ...p, images: [...p.images, { url: body.url, altText: p.title, width: 0, height: 0 }] }));
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); }
    finally { setUploading(false); }
  }
  return <form className="container-organic p-6 mb-6 space-y-4" onSubmit={(e) => { e.preventDefault(); save(p); }}>
    <h2 className="uppercase text-title">Edit product</h2>
    {error && <p role="alert" className="text-red-400">{error}</p>}
    <div className="grid sm:grid-cols-2 gap-4"><label className="text-sm">Name<input required value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} className={input} /></label><label className="text-sm">URL handle<input required pattern="[a-z0-9][a-z0-9-]*" value={p.handle} onChange={(e) => setP({ ...p, handle: e.target.value })} className={input} /></label></div>
    <label className="block text-sm">Description<textarea value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} className={input} /></label>
    <label className="block text-sm">Product type<input value={p.product_type} onChange={(e) => setP({ ...p, product_type: e.target.value })} className={input} /></label>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={p.active} onChange={(e) => setP({ ...p, active: e.target.checked })} />Published in shop</label>
    <div className="flex flex-wrap gap-4">{p.images.map((image, i) => <div key={image.url} className="w-24"><img src={image.url} alt={image.altText ?? p.title} className="w-24 h-24 object-cover container-inset-md" /><button type="button" className="text-sm text-text-secondary mt-2" onClick={() => setP({ ...p, images: p.images.filter((_, j) => j !== i) })}>Remove</button></div>)}</div>
    <label className="block text-sm">Add image (JPG, PNG or WebP, up to 4 MB)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={upload} className="block mt-2" /></label>
    <h3 className="uppercase text-base">Variants</h3>
    {p.merch_variants.map((v, index) => <div key={v.id} className="grid sm:grid-cols-4 items-end gap-3 border-t border-white/[0.06] pt-3">
      <div className="text-sm">{v.title}</div>
      <label className="text-sm">Price ($)<input type="number" step="0.01" min="0.01" required defaultValue={(v.price_cents / 100).toFixed(2)} className={input} onChange={(e) => setP({ ...p, merch_variants: p.merch_variants.map((item, i) => i === index ? { ...item, price_cents: Math.round(Number(e.target.value) * 100) } : item) })} /></label>
      <label className="text-sm">SKU<input value={v.sku} className={input} onChange={(e) => setP({ ...p, merch_variants: p.merch_variants.map((item, i) => i === index ? { ...item, sku: e.target.value } : item) })} /></label>
      <label className="text-sm flex gap-2 p-3"><input type="checkbox" checked={v.active} onChange={(e) => setP({ ...p, merch_variants: p.merch_variants.map((item, i) => i === index ? { ...item, active: e.target.checked } : item) })} />Available in shop</label>
    </div>)}
    <div className="flex flex-wrap gap-3 items-end"><label className="text-sm">New variant label<input id={`variant-${p.id}`} placeholder="M, L, or Default Title" className={input} /></label><button type="button" className={button} onClick={() => {
      const el = document.getElementById(`variant-${p.id}`) as HTMLInputElement; const title = el.value.trim(); if (!title) return;
      setP({ ...p, merch_variants: [...p.merch_variants, { id: `merch-variant-${crypto.randomUUID()}`, product_id: p.id, title, sku: "", price_cents: 2500, currency: "usd", stock: 0, active: true, sort_order: p.merch_variants.length, selected_options: [{ name: p.options[0]?.name ?? "Option", value: title }] }] }); el.value = "";
    }}>Add variant</button></div>
    <p className="text-text-secondary text-sm">New variants start at zero stock. Set the opening count under Inventory after saving.</p>
    <div className="flex gap-3"><button disabled={busy || uploading || !p.merch_variants.length} className={primary}>Save product</button><button type="button" className={button} onClick={close}>Close</button></div>
  </form>;
}
