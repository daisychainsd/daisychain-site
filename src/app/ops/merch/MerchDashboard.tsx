"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { canExport } from "@/lib/merch/csv";
import { orderLabel, type CatalogProduct, type MerchOrder } from "@/lib/merch/types";

const input = "w-full bg-bg-raised text-text-primary border border-white/[0.12] p-3 container-pill-r focus:ring-2 focus:ring-blue-300";
const button = "btn-ghost text-sm disabled:opacity-40 disabled:cursor-not-allowed";
type Adjustment = { id: string; variant_id: string; quantity_delta: number; reason: string; created_at: string };
type Data = { orders: MerchOrder[]; products: CatalogProduct[]; adjustments: Adjustment[]; newOrders: number };
const money = (cents: number, currency = "usd") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
const date = (value: string) => new Date(value).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function MerchDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState("orders");
  const [status, setStatus] = useState("all");
  const [test, setTest] = useState(false);
  const [page, setPage] = useState(0);
  const [selection, setSelection] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const retryKeys = useRef(new Map<string, string>());
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/ops/merch?status=${status}&test=${test}&page=${page}`, { signal, cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Could not load merch");
    setData(body); setSelection([]);
  }, [status, test, page]);
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
  return <div className="max-w-7xl mx-auto px-6 py-12">
    <Link href="/ops" className="text-blue-300 text-sm">← Back to Ops</Link>
    <div className="flex flex-wrap items-end justify-between gap-4 my-8">
      <div><p className="text-label text-blue-300 mb-2">Internal · {data?.newOrders ?? "—"} new {data?.newOrders === 1 ? "order" : "orders"}</p><h1 className="text-headline uppercase m-0">Merch</h1></div>
      <button className={button} disabled={busy} onClick={() => { setError(""); load().catch((e) => setError(e.message)); }}>Refresh</button>
    </div>
    <nav className="flex flex-wrap gap-3 mb-6" aria-label="Merch sections">
      {["orders", "inventory", "products"].map((t) => <button key={t} aria-current={tab === t ? "page" : undefined} className={tab === t ? "btn-primary text-sm" : button} onClick={() => setTab(t)}>{t.toUpperCase()}</button>)}
    </nav>
    {error && <p role="alert" className="container-organic p-4 text-red-400">{error}</p>}
    {message && <p role="status" className="container-organic p-4 text-blue-300">{message}</p>}
    {!data && <p className="text-text-secondary">{error ? "Merch data is unavailable. Refresh once setup is complete." : "Loading merch…"}</p>}
    {data && tab === "orders" && <>
      <p className="text-text-secondary text-sm">Check older orders against Pirate Ship, then mark shipped or unshipped. Tracking is optional. Exporting a CSV does not mark an order shipped.</p>
      <div className="container-organic p-5 mb-5 flex flex-wrap items-end gap-4">
        <label className="text-sm">Status<select className={input} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
          {["all", "unshipped", "shipped", "new", "exported", "on_hold"].map((s) => <option key={s} value={s}>{s === "new" ? "New / unshipped" : s.replace("_", " ")}</option>)}
        </select></label>
        <label className="flex items-center gap-2 p-3 text-sm"><input type="checkbox" checked={test} onChange={(e) => { setTest(e.target.checked); setPage(0); }} />Test orders</label>
        <button className={button} disabled={busy || !eligible.length} onClick={() => setSelection(eligible.map((o) => o.id))}>Select eligible</button>
        <button className="btn-primary text-sm disabled:opacity-40" disabled={busy || !selection.length || test}
          onClick={() => action("export", { ids: selection, reexport: false }, true)}>Export CSV ({selection.length})</button>
        <button className={button} disabled={busy || !selection.length || test} onClick={() => action("export", { ids: selection, reexport: true }, true)}>Re-export selected</button>
      </div>
      <p className="text-text-secondary text-sm mb-5">One row per shipment. Map the address and email columns in Pirate Ship, then choose your package size and weight. Enable Pirate Ship’s shipment emails when buying labels.</p>
      {test && <p className="text-blue-300">Test orders do not change inventory and cannot be exported or marked shipped.</p>}
      <div className="space-y-4">{data.orders.map((order) => <OrderCard key={order.id} order={order} selected={selection.includes(order.id)} busy={busy}
        select={() => setSelection((ids) => ids.includes(order.id) ? ids.filter((id) => id !== order.id) : [...ids, order.id])}
        save={(body) => action("order", body)} />)}</div>
      {!data.orders.length && <div className="container-organic p-10 text-text-secondary">No orders in this view.</div>}
      <div className="flex items-center justify-between mt-6"><button className={button} disabled={!page || busy} onClick={() => setPage(page - 1)}>Previous</button><span className="font-mono text-sm">Page {page + 1}</span><button className={button} disabled={data.orders.length < 50 || busy} onClick={() => setPage(page + 1)}>Next</button></div>
    </>}
    {data && tab === "inventory" && <>
      <section className="container-organic p-6 mb-6">
        <h2 className="uppercase text-title mb-3">Adjust inventory</h2>
        <p className="text-text-secondary text-sm mb-5">Enter negative quantities for booth sales and positive quantities for restocks or returns. Taking a Tap to Pay payment does not update this count automatically.</p>
        <form className="grid md:grid-cols-4 gap-4 items-end" onSubmit={async (e) => {
          e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
          if (await action("inventory", { variantId: f.get("variantId"), delta: Number(f.get("delta")), reason: f.get("reason") })) form.reset();
        }}>
          <label className="text-sm md:col-span-2">Item<select required name="variantId" className={input}>{variants.map((v) => <option key={v.id} value={v.id}>{v.productTitle} / {v.title} ({v.stock})</option>)}</select></label>
          <label className="text-sm">Quantity change<input required name="delta" type="number" step="1" min="-100000" max="100000" placeholder="−3 or +10" className={input} /></label>
          <label className="text-sm md:col-span-3">Reason<input required name="reason" maxLength={300} placeholder="Booth sales — show/date, restock, or count correction" className={input} /></label>
          <button className="btn-primary disabled:opacity-40" disabled={busy || !variants.length}>Save adjustment</button>
        </form>
      </section>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">{variants.map((v) => <div key={v.id} className="container-organic p-5 min-w-0"><p className="font-semibold m-0">{v.productTitle}</p><p className="text-text-secondary text-sm">{v.title} · {v.sku || "No SKU"}</p><p className={`font-mono text-2xl m-0 ${v.stock <= 0 ? "text-red-400" : "text-blue-300"}`}>{v.stock} <span className="text-sm">remaining</span></p>{!v.active && <span className="text-text-secondary text-xs">Hidden variant</span>}</div>)}</div>
      <section className="container-organic p-6"><h2 className="uppercase text-title mb-4">Recent adjustments</h2>{data.adjustments.map((a) => <div key={a.id} className="border-t border-white/[0.06] py-3 flex flex-wrap gap-x-4 gap-y-1 text-sm"><span className="font-mono text-blue-300">{a.quantity_delta > 0 ? "+" : ""}{a.quantity_delta}</span><span>{variants.find((v) => v.id === a.variant_id)?.productTitle} / {variants.find((v) => v.id === a.variant_id)?.title}</span><span className="text-text-secondary">{a.reason}</span><span className="font-mono text-text-secondary ml-auto">{date(a.created_at)} PT</span></div>)}{!data.adjustments.length && <p className="text-text-secondary">No adjustments yet.</p>}</section>
    </>}
    {data && tab === "products" && <>
      <button className="btn-primary mb-5" disabled={busy} onClick={() => setEditing({ id: `merch-product-${crypto.randomUUID()}`, handle: "", title: "", description: "", product_type: "", active: false, images: [], options: [], tags: [], merch_variants: [] })}>Add product</button>
      {editing && <ProductEditor key={editing.id} product={editing} busy={busy} close={() => setEditing(null)} save={async (product) => { if (await action("product", product)) setEditing(null); }} />}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{data.products.map((p) => <div key={p.id} className="container-organic p-5 min-w-0">{p.images[0] && <img src={p.images[0].url} alt={p.title} className="container-inset-md w-full aspect-square object-cover mb-4" />}<h2 className="uppercase text-lg">{p.title}</h2><p className="text-text-secondary text-sm">{p.active ? "Published" : "Hidden"} · {p.merch_variants.length} variants</p><button className={button} onClick={() => setEditing(p)}>Edit product</button></div>)}</div>
    </>}
  </div>;
}

function OrderCard({ order: o, selected, select, save, busy }: { order: MerchOrder; selected: boolean; select: () => void; busy: boolean; save: (body: object) => Promise<boolean> }) {
  const a = o.shipping_address;
  return <article className="container-organic p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <label className="flex gap-3 items-center"><input type="checkbox" checked={selected} disabled={!canExport(o) || busy} onChange={select} aria-label={`Select ${orderLabel(o)}`} /><span className="font-mono text-blue-300">{orderLabel(o)}</span><span className="text-text-secondary text-xs">{o.fulfillment_status.replace("_", " ")}</span></label>
      <span className="font-mono text-sm">{money(o.total_cents, o.currency)} · {o.payment_status.replaceAll("_", " ")}</span>
    </div>
    <p className="font-mono text-text-secondary text-xs mt-3">{date(o.created_at)} PT{o.exported_at ? ` · Exported ${date(o.exported_at)}` : ""}</p>
    {o.inventory_issue && <p className="text-red-400 text-sm">Inventory needs review. Correct the stock count and explain the resolution before releasing this order.</p>}
    <div className="grid sm:grid-cols-2 gap-5 my-4">
      <div className="text-sm break-words"><strong>{o.customer_name || "Missing recipient name"}</strong><div>{o.email}</div><div>{a.line1 || "Missing shipping address"}</div>{a.line2 && <div>{a.line2}</div>}<div>{[a.city, a.state, a.postal_code].filter(Boolean).join(", ")}</div><div>{a.country} {o.phone}</div></div>
      <ul className="list-none p-0 m-0 text-sm">{o.items.map((i, index) => <li key={index} className="mb-2"><span className="font-mono text-blue-300">{i.quantity} × </span>{i.title}{i.variant_title !== "Default Title" ? ` / ${i.variant_title}` : ""}{i.sku ? ` [${i.sku}]` : ""}<span className="text-text-secondary"> · {money(i.unit_price_cents, o.currency)}</span></li>)}<li className="text-text-secondary">Shipping {money(o.shipping_cents, o.currency)} · Tax {money(o.tax_cents, o.currency)} · Discount {money(o.discount_cents, o.currency)}</li></ul>
    </div>
    <button className={`${button} mb-4`} disabled={busy || !o.livemode || o.inventory_issue || ["refunded", "disputed"].includes(o.payment_status)}
      onClick={() => save({ id: o.id, status: o.fulfillment_status === "shipped" ? "new" : "shipped", tracking: o.tracking_number ?? "", notes: o.notes, resolveStock: false })}>
      {o.fulfillment_status === "shipped" ? "Mark unshipped" : "Mark shipped"}
    </button>
    {o.shipped_at && <p className="text-text-secondary text-xs">Marked shipped {date(o.shipped_at)} PT</p>}
    <details key={`${o.fulfillment_status}:${o.tracking_number}:${o.notes}`}><summary className="text-blue-300 cursor-pointer text-sm">Fulfillment and notes</summary>
      <form className="grid sm:grid-cols-2 gap-4 mt-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); save({ id: o.id, status: f.get("status"), tracking: f.get("tracking"), notes: f.get("notes"), resolveStock: f.get("resolveStock") === "on" }); }}>
        <label className="text-sm">Status<select name="status" defaultValue={o.fulfillment_status} className={input}><option value="new">Unshipped</option>{o.fulfillment_status === "exported" && <option value="exported">Exported</option>}<option value="on_hold">On hold</option><option value="shipped">Shipped</option></select></label>
        <label className="text-sm">Tracking number (optional)<input name="tracking" defaultValue={o.tracking_number ?? ""} maxLength={200} className={input} /></label>
        <label className="text-sm sm:col-span-2">Internal notes<textarea name="notes" defaultValue={o.notes} maxLength={2000} className={input} /></label>
        {o.inventory_issue && <label className="text-sm flex items-center gap-2"><input type="checkbox" name="resolveStock" />Inventory issue resolved</label>}
        <button className={`${button} justify-self-start`} disabled={busy}>Save fulfillment</button>
      </form>
      <p className="text-text-secondary text-xs mt-4">Confirmation email: {o.confirmation_email_sent_at ? `sent ${date(o.confirmation_email_sent_at)}` : "not recorded as sent"}. Shipping notifications are sent through Pirate Ship. Refunds and returns require a manual stock adjustment.</p>
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
    <div className="flex gap-3"><button disabled={busy || uploading || !p.merch_variants.length} className="btn-primary disabled:opacity-40">Save product</button><button type="button" className={button} onClick={close}>Close</button></div>
  </form>;
}
