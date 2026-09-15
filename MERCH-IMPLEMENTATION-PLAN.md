# Daisy Chain merch: implementation and rollout

## Intended result

The existing shop and Stripe checkout feed a Supabase-backed `/ops/merch` dashboard. Staff review paid orders, export one CSV row per shipment for Pirate Ship, record tracking/shipped status, and adjust inventory for booth sales or restocks. Stripe Dashboard on iPhone remains the manual Tap to Pay interface.

## Decisions

- Supabase owns products, variants, order snapshots, fulfillment status and the inventory adjustment ledger. Product content and images are editable through Ops; Shopify handles and variant IDs remain valid after import.
- Keep existing shipping countries and rates for this change; the previously asked shipping-policy question remains open. Do not introduce tax policy changes. Remove the unsupported free-shipping promise from the shop copy.
- V1 checks merged quantities against current stock before checkout and deducts stock atomically once per paid session. It does not reserve carts. If concurrent checkouts buy the final item, preserve both paid orders and put the shortage on hold for staff to resolve/refund. Manual booth entries cannot push stock negative. Refunds do not automatically restock; staff count actual returned/unshipped merchandise.
- Test orders are visibly separate and never decrement stock or export for shipping. Isolated tests use synthetic records and an in-memory PostgreSQL engine, never the shared Supabase instance or live Stripe key.
- New exports and deliberate re-exports are separate actions. Exporting does not mark an order shipped. Pirate Ship uses recipient email for its shipping notifications; Ops stores tracking but does not claim to send an automated shipping email.
- `MERCH_BACKEND=supabase` activates the new catalog/checkout/webhook; unset preserves Shopify for a controlled rollout. Existing Shopify helpers remain only for rollback/import until the cutover is verified.

## Build sequence

1. Implement and test database transactions: paid order persistence, stock ledger, payment blocks, manual adjustments, fulfillment transitions and export batches. Deny anon/authenticated direct access.
2. Implement the server-priced checkout snapshot, physical webhook dispatcher before legacy deduplication, compatibility for in-flight legacy physical sessions, and accurate success states. Preserve digital purchase behavior and cart contents.
3. Build `/ops/merch` with orders, filters, CSV, fulfillment, inventory history and catalog editing/image upload. Explicitly authorize every route, reject cross-origin writes and use no-store for customer data.
4. Prepare a dry-run-first paginated Shopify catalog/image importer and manual opening-stock adjustment workflow. Existing counts must be reconciled with a physical count; never invent available stock.
5. Run SQL integration tests, route tests, typecheck/lint/build and browser checks. Have Claude adversarially review the complete diff, fix valid findings and request a follow-up review.
6. Deploy only after review. Preview deployment targets `dev`, per CLAUDE.md; production still follows the explicit go-live workflow. Apply additive schema and import data before enabling the Supabase backend. Production cancellation/billing changes are outside this implementation.

## Release gates

- No lost or duplicate order/stock adjustment on webhook retries.
- Unpaid/test/refunded/disputed/held orders cannot accidentally enter shipping exports.
- Stock conflicts and missing catalog items stay visible in Ops.
- CSV preserves Unicode, commas, quotes, ZIP leading zeroes and international phone numbers.
- Auth/CSRF protection is exercised against the actual routes.
- Products/images/variant IDs and opening counts verified before switching backend.
- Claude's findings resolved or explicitly documented; no outstanding release-blocking defect.

See `MERCH-REVIEW-2026-09-14.md` for the earlier draft review. That historical report describes the pre-implementation checkpoint, not current completion status.
