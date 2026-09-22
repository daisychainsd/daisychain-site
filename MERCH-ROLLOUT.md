# Merch Ops: shipping and catalog rollout

## Current state — September 22, 2026

Four paid physical website orders were recovered into production Supabase and verified through the live Ops API. The merch schema and optional-tracking migration are applied. [ORDER-RECOVERY-2026-09-22.md](ORDER-RECOVERY-2026-09-22.md) records the exact production deployment status of PR #24 and its adversarial review.

The order-recovery implementation records paid website orders directly in Ops, independent of the catalog backend. Shopify still supplies the storefront catalog because `MERCH_BACKEND` is unset. Supabase product/image import, image storage setup and opening inventory counts remain pending. The Inventory and Products tabs must not be treated as the current Shopify stock/catalog.

## Daily fulfillment

1. Open [Merch Ops](https://www.daisychainsd.com/ops/merch). All is the default; use Unshipped for new, exported and held orders. The recent-orders panel on the main Ops dashboard is a payment summary, not the fulfillment queue. Refresh explicitly for newer orders.
2. Read the items, quantities, sizes, address, payment status and notes. For recovered orders, compare with Pirate Ship before shipping. All four recovered orders initially remain unshipped because shipping history was not verified.
3. Select eligible paid orders and Export CSV. Import it into Pirate Ship, mapping name, email, phone and address columns. Keep ZIP/postal codes as text. Supply package weight/dimensions and international customs details in Pirate Ship.
4. After confirming shipment, choose Mark shipped. Tracking is optional. Use Mark unshipped to undo an accidental mark. If a CSV was already exported, the order returns to On hold so its existing Pirate Ship label can be checked before another export. Fulfillment and notes contains the detailed status/tracking/notes form. Manual updates do not email customers or change stock; enable shipment emails in Pirate Ship.
5. CSV download means Exported, not Shipped. Re-export selected intentionally when replacing a failed/lost CSV. Check Pirate Ship before purchasing another label.

**Held orders:** investigate refunds, disputes or stock issues before shipping. Refunded/disputed orders cannot be released to shipping. A partial refund can be explicitly released after review. For inventory-managed orders, correct the stock count and record the resolution before releasing a shortage. Refunds do not automatically restock products.

**Confirmation delivery:** the order card indicates whether delivery was recorded. An email failure does not remove the paid order. Historical recovery does not resend customer confirmations. The team workflow is also documented in [daisychain-ops/SOP-merch-fulfillment.md](https://github.com/daisychainsd/daisychain-ops/blob/main/SOP-merch-fulfillment.md).

## Missing order or failed sync

Search the paid physical checkout in Stripe, then compare its session ID with Ops. The signed webhook saves orders immediately; the hourly reconciliation at minute 15 recovers missed sessions. Its scope is physical website Stripe Checkout purchases, not independent Shopify, Bandcamp or booth orders. A green storage check alone is not proof that all Stripe orders are present.

See [OPERATIONS.md](OPERATIONS.md#recover-or-audit-physical-orders) for the read-only audit and `--apply` recovery commands. They paginate completed Stripe history, check payment state during import, and preserve manual fulfillment decisions. Escalate failed reconciliation or retrying webhooks to PD; don't infer shipping status from payment or CSV export.

## Separate project: replacing the Shopify catalog

The September 14 code shipped in [PR #20](https://github.com/daisychainsd/daisychain-site/pull/20), but its rollout was unfinished. The original read-only snapshot contained 13 products, 33 variants and 44 image references. Refresh/review it before using it; it is not a current stock count.

1. Review [the original implementation/review](MERCH-IMPLEMENTATION-PLAN.md), [the September 14 review](MERCH-IMPLEMENTATION-REVIEW-2026-09-14.md), and the current recovery changes. Run the appropriate tests, TypeScript, lint and production build after changes.
2. **Do not rerun `scripts/merch-schema-2026-09-14.sql`: it is already applied.** Verify/apply the separate `scripts/merch-storage-2026-09-14.sql` before importing images. Never apply the full `supabase-schema.sql` to the existing production database.
3. Run `node --env-file=/path/to/env scripts/merch-import.mjs` for a fresh read-only catalog/image snapshot, then review `.merch-import/`. `--apply` copies it to Supabase. New variants begin at zero; repeated import preserves stock but overwrites product content.
4. Count physical stock and enter opening adjustments in Ops close to cutover. Reconcile intervening online and booth sales. Legacy Shopify-era order imports do not deduct Supabase inventory, so include outstanding orders when planning the count/cutover.
5. Verify the Supabase-backed storefront and purchase/webhook flow against an isolated test database and test Stripe account, with outbound notifications disabled. Dev shares production services and is not a disposable checkout test environment.
6. Validate product images, release links, prices, paid order persistence, shortage handling, and Pirate Ship mapping/label creation. Ensure the live Stripe endpoint subscribes to completed checkout, delayed-payment success, refund and dispute events.
7. Activate `MERCH_BACKEND=supabase` only as a reviewed, explicitly authorized cutover. Monitor the first real order. Keep Shopify available until the rollout and remaining Shopify history reconciliation are complete.

When the Supabase catalog is active, Products edits affect the storefront and Inventory manages opening counts, booth sales and restocks. Stripe Tap to Pay booth payments do not automatically update counts. No inventory values have been invented for this recovery.

## Rollback and limits

Unsetting `MERCH_BACKEND` changes new catalog/checkout pricing back to Shopify; physical orders continue to persist in Ops. In-flight Supabase snapshots retain their inventory behavior. Rolling back to pre-PR #24 code would restore the old Shopify-only fulfillment path and lose the new recovery protection; audit Stripe immediately if that rollback is necessary.

Inventory-managed checkout validates stock but does not reserve it. Concurrent purchases can create a visible shortage hold instead of losing a paid order. CSV exports contain at most 100 shipments. Ops shares one password rather than per-person accounts. Product image uploads support JPG/PNG/WebP up to 4 MB in Ops; the direct importer supports 10 MB. Public success pages do not expose customer shipping details.

Resolved disputes are not automatically released to shipping. After verifying a won/closed dispute in Stripe, a developer must reconcile the stored payment block and order payment status; the hourly job will not recreate a block for a resolved dispute.
