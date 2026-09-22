# Physical website order recovery

Production diagnosis: Stripe contains four paid physical website Checkout Sessions across the full 55 completed-session history. The `merch_orders` table is absent; the live `/api/ops/merch` endpoint returns 500. The storefront backend flag is unset, so the existing webhook routed physical payments exclusively to Shopify draft creation and never persisted them to Ops. The Shopify Admin token exchange currently returns HTTP 400. No refunds or disputes were present on these four payments at the time of the audit.

## Changes

- Every physical payment goes through retryable, session-idempotent Ops persistence, independent of the catalog backend. Shopify draft creation is removed from this path.
- Legacy purchases use Stripe's captured item names, variants, quantities, prices and shipping addresses, including older top-level shipping fields. Historical/Shopify purchases do not change Supabase inventory.
- Orders open in All. Unshipped includes new, exported and held orders. Each card has Mark shipped / Mark unshipped; tracking is optional. Refunded/disputed and inventory-held orders retain their safety checks.
- `scripts/merch-reconcile.ts` audits all completed sessions using Stripe pagination. `--apply` imports missing orders and checks refunds/disputes, preserving manual fulfillment decisions. No customer emails or Shopify drafts are sent during recovery. An hourly protected cron runs the same reconciliation.
- Ops health checks now detect absent physical-order storage even while Shopify supplies the catalog.

## Activation (required before production code deployment)

1. Run `scripts/merch-schema-2026-09-14.sql` once in the existing Supabase project, followed by `scripts/merch-shipping-2026-09-22.sql`. Do not run the full `supabase-schema.sql`. The local database was confirmed to have none of the merch tables. A combined copy including all four recovered order payloads (customer data; never commit it) is saved in `~/Downloads/Daisy-Chain-Order-Recovery-2026-09-22/setup-ops-orders.sql`.
2. If using the individual schema files rather than the combined recovery SQL, run `node --env-file=/path/to/production.env --import tsx scripts/merch-reconcile.ts --apply`. Then run reconciliation again: imported should be zero and all four orders must remain present with the same fulfillment state.
3. Verify the authenticated production API lists all four physical orders with items and addresses. Recovery files with customer data live outside Git under `~/Downloads/Daisy-Chain-Order-Recovery-2026-09-22/`.
4. Deploy through dev → PR → main. Keep MERCH_BACKEND unset: this repair does not activate the unfinished inventory/catalog migration.
5. Verify production All/Unshipped, read-only item/address display, and the protected reconciliation cron. Do not invent shipping status for real orders. PD will reconcile Pirate Ship and mark shipping manually.

## Validation

23 automated tests include actual signed webhook handling with the backend flag unset, failed-write retries, duplicate deliveries, legacy address recovery, shipping without tracking and reversal, inventory/refund protections and access control. Production webpack build passes. Browser checks exercise the real built dashboard against isolated fixture API responses; they do not certify live database integration.

Database migration/import and live deployment remain pending until SQL administration access is supplied or the migration is run. Existing local service credentials cannot execute DDL. Do not describe the backlog as imported until the production audit passes.
