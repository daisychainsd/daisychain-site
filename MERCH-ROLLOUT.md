# Merch Ops: products, inventory and shipping

## Current state — September 30, 2026

Four paid physical website orders were recovered into production Supabase and verified through the live Ops API. The merch schema and optional-tracking migration are applied. [ORDER-RECOVERY-2026-09-22.md](ORDER-RECOVERY-2026-09-22.md) records the exact production deployment status of PR #24 and its adversarial review.

Ops now controls the live shop catalog, prices, photos, sizes and stock. `MERCH_BACKEND=supabase` is enabled in production and the dev preview. All 14 products, 38 variants and DCM01–DCM38 SKUs were verified at launch; 384 opening units and the requested sale prices were applied. [PR #28](https://github.com/daisychainsd/daisychain-site/pull/28) is live; see the [release record](MERCH-PRODUCT-EDITOR-2026-09-29.md). Orders continue to persist independently of this flag.

## Daily fulfillment

1. Open [Merch Ops](https://www.daisychainsd.com/ops/merch). Unshipped is the default, including new, exported and held orders. Use Shipped or All orders for history; source and advanced filters narrow the queue. The recent-orders panel on the main Ops dashboard is a payment summary, not the fulfillment queue. Refresh explicitly for newer orders.
2. Read the items, quantities, sizes, address, payment status and notes. For recovered orders, compare with Pirate Ship before shipping. The four website orders were initially recovered as unshipped; current status reflects subsequent manual updates.
3. Select eligible paid orders, then use Export CSV in the selection bar. Import it into Pirate Ship, mapping name, email, phone and address columns. Keep ZIP/postal codes as text. Supply package weight/dimensions and international customs details in Pirate Ship.
4. After confirming shipment, choose Mark shipped. Tracking is optional. Use Mark unshipped to undo an accidental mark. If a CSV was already exported, the order returns to On hold so its existing Pirate Ship label can be checked before another export. Fulfillment and notes contains the detailed status/tracking/notes form. Manual updates do not email customers or change stock; enable shipment emails in Pirate Ship.
5. CSV download means Exported, not Shipped. Re-export selected intentionally when replacing a failed/lost CSV. Check Pirate Ship before purchasing another label.

**Held orders:** investigate refunds, disputes or stock issues before shipping. Refunded/disputed orders cannot be released to shipping. A partial refund can be explicitly released after review. For inventory-managed orders, correct the stock count and record the resolution before releasing a shortage. Refunds do not automatically restock products.

**Confirmation delivery:** the order card indicates whether delivery was recorded. An email failure does not remove the paid order. Historical recovery does not resend customer confirmations. The team workflow is also documented in [daisychain-ops/SOP-merch-fulfillment.md](https://github.com/daisychainsd/daisychain-ops/blob/main/SOP-merch-fulfillment.md).

## Missing order or failed sync

Search the paid physical checkout in Stripe, then compare its session ID with Ops. The signed webhook saves orders immediately; the hourly reconciliation at minute 15 recovers missed sessions. Its scope is physical website Stripe Checkout purchases, not independent Shopify-native or booth orders. Bandcamp uses its own hourly physical-order reconciliation at minute 25. A green storage check alone is not proof that all Stripe orders are present.

See [OPERATIONS.md](OPERATIONS.md#recover-or-audit-physical-orders) for the read-only audit and `--apply` recovery commands. They paginate completed Stripe history, check payment state during import, and preserve manual fulfillment decisions. Escalate failed reconciliation or retrying webhooks to PD; don't infer shipping status from payment or CSV export.

## Products, sizes and stock

1. Open Inventory or Products in [Merch Ops](https://www.daisychainsd.com/ops/merch). Both show clickable product thumbnails with sizes/options and total stock. Click the product or its Edit product action.
2. Review each size's current stock. Enter signed **Add/remove** quantities and check the projected result: `-2` removes two units, `5` adds five. To correct 12 units to 9, enter `-3`, not `9`. Enter a reason, then Save stock changes.
3. Confirmed rows clear after saving. If a save response is interrupted, use **Retry remaining changes**. The same request keys are retained so retries do not duplicate stock adjustments; navigation stays locked while the outcome is unknown.
4. Choose **Edit product & sizes** for name, description, visibility, photos, sizes/options, regular price, discount and SKU. Add or rename sizes in the product's own rows. New sizes inherit that product's price and receive the next suggested DCM code. Every variant/size has its own SKU. Save product to apply changes; stock remains managed by adjustments.
5. A product must be published, its variant active, and that variant's stock positive to be available for sale. Product/price changes reach the cached shop grid on its next revalidation (configured at 60 seconds). Checkout validates current stock and prices on the server.

New website purchases through the Ops-backed checkout deduct stock once when paid. Bandcamp orders, legacy Shopify-era checkouts and Stripe Tap to Pay booth sales do **not** deduct this stock automatically. Reconcile those sales manually with a reason. Refunds do not automatically restock products; count returned or unshipped stock before adding it back.

## Discounts

Open **Edit product & sizes**. The size rows contain **Regular price ($)**. Below them, enable **Offer a discount**, choose a whole-number percentage from 1 through 99, and review every size's sale price before **Save product**. Discounts apply to all sizes, including new sizes. Disabling the offer and saving restores their regular prices. Reopening or resaving a discounted product never applies another discount. Reload older open Ops tabs if the server asks you to refresh the editor.

The storefront shows the original price struck through, the effective price, and a red percentage badge. Checkout reads the saved effective price from Ops. Tiny prices whose discount would round to zero or fail to reduce the price are rejected. Existing Stripe promotion codes still stack with sale prices; manage coupon terms in Stripe.

## Homepage and Shop ordering in Sanity

Use **Studio → Homepage → Homepage shop products** and **Studio → Shop → Shop products** independently. Click **Add all in-stock products not yet listed** to fill the list in one step (it appends only products that are missing, so it never creates duplicates), drag to reorder and remove any you do not want while automatic mode remains on. Single rows can still be added with **Add item**; their picker no longer offers products already in the list, then enable **Choose products and their order**. Homepage settings are live-edit, so toggling an empty list immediately hides its merch strip. Shop settings require **Publish**. Manual mode shows the exact list and can contain more than the automatic homepage default of four items. The automatic Shop list includes all published Ops products.

Selections store stable Ops IDs, so renaming a product or changing its handle, image, price or discount in Ops does not break its placement. There is no product sync cron or duplicated Sanity product record. The picker refreshes on focus and every minute with a short public catalog cache. Pages revalidate at 60 seconds. Hidden/deleted products are skipped; only published products with an available size can be newly selected. Previously selected products that sell out remain labeled and cannot be newly selected; replace or remove them from the saved list. Restocking makes them selectable again. Selecting a product does not override its stock. If Sanity placement lookup fails, Shop falls back to the published Ops catalog. To prevent sales through direct URLs, unpublish the product in Ops; removing its CMS placement only removes it from that section.

## Thumbnail framing

Open **Edit product & sizes** and find **Thumbnail framing** below the product photos. Enable **Crop to fill square**, adjust Zoom (1–3×), Horizontal position and Vertical position (0–100%), then Save product. **Reset to full photo** removes the crop setting. The preview and shop/Ops cards use the first product photo; the large product-detail image uses the same saved framing. Original uploaded files remain intact, and images without crop metadata display their full photo.

These controls are independent of Sanity's flyer crop tool. Merch framing is stored in the image's `thumbnailCrop` metadata and shared by Ops, shop cards, the homepage shop strip, gallery thumbnails and the selected large product-detail image.

## Completed catalog migration

The original 13 products, 33 variants and 44 image references were imported with handles/variant IDs preserved. The public `merch-images` bucket is configured. The staple tee adds five variants, for 14 products and 38 variants. The [release record](MERCH-PRODUCT-EDITOR-2026-09-29.md) contains the confirmed opening counts and prices.

**Do not rerun the production schema, full catalog importer or opening-count setup.** Repeated catalog import can overwrite product edits. The 384-unit snapshot is historical; later sales must not be replenished by resetting it. The one-time scripts and request IDs are retained for audit/recovery only. Shopify cancellation and historical-order export remain separate work; no subscription was cancelled during this release.

## Rollback and limits

Unsetting `MERCH_BACKEND` and redeploying changes new catalog/checkout pricing back to Shopify; physical orders continue to persist in Ops. This is not a catalog sync: the staple tee and current Ops prices/counts will not automatically exist in Shopify. Reconcile the fallback catalog before a rollback. In-flight Supabase snapshots retain their inventory behavior. Rolling back to pre-PR #24 code would restore the old Shopify-only fulfillment path and lose the new recovery protection; audit Stripe immediately if that rollback is necessary.

Inventory-managed checkout validates stock but does not reserve it. Concurrent purchases can create a visible shortage hold instead of losing a paid order. CSV exports contain at most 100 shipments. Ops shares one password rather than per-person accounts. Product image uploads support JPG/PNG/WebP up to 4 MB in Ops; the direct importer supports 10 MB. Public success pages do not expose customer shipping details.

Resolved disputes are not automatically released to shipping. After verifying a won/closed dispute in Stripe, a developer must reconcile the stored payment block and order payment status; the hourly job will not recreate a block for a resolved dispute.


## Bandcamp order extension

Eight physical Bandcamp orders were imported and verified September 22; all retained their recorded shipped status. Physical Bandcamp merchandise joins the shipping queue through a separate hourly feed. Digital sales are excluded. Source → Bandcamp identifies these orders; the first import carries its recorded shipped status and later syncs preserve manual Ops decisions. Pending/failed/refunded or partially shipped orders need review before fulfillment. Ops toggles do not write back to Bandcamp. Bandcamp inventory remains separate even after the September 29 shop cutover. See [Bandcamp setup and verification](BANDCAMP-ORDERS-2026-09-22.md).
