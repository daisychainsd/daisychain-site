# Physical website order recovery

Initial production diagnosis: Stripe contains four paid physical website Checkout Sessions across the full 55 completed-session history. The `merch_orders` table was absent; the live `/api/ops/merch` endpoint returned 500. The storefront backend flag is unset, so the existing webhook routed physical payments exclusively to Shopify draft creation and never persisted them to Ops. The Shopify Admin token exchange returned HTTP 400 during diagnosis. No refunds or disputes were present on these four payments at the time of the audit.

## Changes

- Every physical payment goes through retryable, session-idempotent Ops persistence, independent of the catalog backend. Shopify draft creation is removed from this path.
- Legacy purchases use Stripe's captured item names, variants, quantities, prices and shipping addresses, including older top-level shipping fields. Historical/Shopify purchases do not change Supabase inventory.
- Orders open in All. Unshipped includes new, exported and held orders. Each card has Mark shipped / Mark unshipped; tracking is optional. Refunded/disputed and inventory-held orders retain their safety checks.
- `scripts/merch-reconcile.ts` audits all completed sessions using Stripe pagination. `--apply` imports missing orders and checks refunds/disputes, preserving manual fulfillment decisions. No customer emails or Shopify drafts are sent during recovery. An hourly protected cron runs the same reconciliation.
- Ops health checks now detect absent physical-order storage even while Shopify supplies the catalog.

## Recovery sequence (completed September 22; reference only)

The schema and backlog import below are already complete. Do not rerun the create-table migration on production.

1. Run `scripts/merch-schema-2026-09-14.sql` once in the existing Supabase project, followed by `scripts/merch-shipping-2026-09-22.sql`. Do not run the full `supabase-schema.sql`. The production order table was confirmed missing before setup. A combined copy including all four recovered order payloads (customer data; never commit it) is saved in `~/Downloads/Daisy-Chain-Order-Recovery-2026-09-22/setup-ops-orders.sql`.
2. If using the individual schema files rather than the combined recovery SQL, run `node --env-file=/path/to/production.env --import tsx scripts/merch-reconcile.ts --apply`. Then run reconciliation again: imported should be zero and all four orders must remain present with the same fulfillment state.
3. Verify the authenticated production API lists all four physical orders with items and addresses. Recovery files with customer data live outside Git under `~/Downloads/Daisy-Chain-Order-Recovery-2026-09-22/`.
4. Deploy through dev → PR → main. Keep MERCH_BACKEND unset: this repair does not activate the unfinished inventory/catalog migration.
5. Verify production All/Unshipped, read-only item/address display, and the protected reconciliation cron. Do not invent shipping status for real orders. PD will reconcile Pirate Ship and mark shipping manually.

## Validation

31 automated tests include actual signed webhook handling with the backend flag unset, failed-write retries, duplicate deliveries, legacy address recovery, shipping without tracking and reversal, inventory/refund protections and access control. Production webpack build passes. Browser checks exercise the real built dashboard against isolated fixture API responses; they do not certify live database integration.

## Live recovery checkpoint

PD ran the combined setup/recovery SQL in the production Supabase SQL Editor on September 22. Verified all four orders, item quantities and shipping addresses through the database and the authenticated production API (HTTP 200). Reconciliation then scanned all 55 completed sessions and found four physical orders, zero missing, zero newly imported, and zero failures. All four remain unshipped with the Pirate Ship reconciliation note; no shipping status was inferred.

**Production is live.** [PR #24](https://github.com/daisychainsd/daisychain-site/pull/24) merged September 22 at 19:10:18 UTC as `6c6c6d60d709f248c9ce90a8db08944331be0918`, after PD's go-ahead and requested Claude adversarial review. Vercel production deployment `dpl_ttJgkFJd2AivyyJNWa7PsTum5JYh` (`daisychain-site-71510p6gg-playerdave-1800s-projects.vercel.app`) was verified Ready. [Claude's review and dispositions](ORDER-RECOVERY-REVIEW-2026-09-22.md) conclude SHIP with no remaining P1/P2 findings.

Verified on `www.daisychainsd.com/ops/merch`: All defaults correctly, Unshipped loads, shipping controls render, and the fourth recovered order is visible. No actual shipment state was toggled for testing. The anonymous Supabase role is denied permission to execute `update_merch_order` (42501); the optional-tracking migration retained its access restrictions.

**Automatic recovery verified:** Vercel registered `/api/cron/merch-reconcile` at `15 * * * *`. Its first scheduled production request at **2026-09-22 19:15:34 UTC** returned **HTTP 200**. All four orders' fulfillment states, notes, tracking and shipping/export timestamps matched the pre-run snapshot afterward. A fresh Stripe audit returned 55 completed sessions, four physical orders, zero missing, zero imported and zero failures. An unauthenticated request returned 401.

`CRON_SECRET` was already configured as a sensitive Preview/Production variable; Vercel intentionally exports it as blank. It was not changed or rotated. A blank local `vercel env pull` value is not evidence that a sensitive production secret is absent; inspect Vercel metadata and real scheduler execution instead.

Related documentation is merged in [daisychain-ops PR #1](https://github.com/daisychainsd/daisychain-ops/pull/1), [system map/onboarding PR #1](https://github.com/daisychainsd/daisychainsd/pull/1), and [organization profile PR #1](https://github.com/daisychainsd/.github/pull/1). The new shipping SOP lives in the Ops repository; existing Google Doc SOPs were not rewritten. Shopify remains the catalog, and its replacement/import/opening stock counts remain unfinished.


## Subsequent Bandcamp extension

Eight physical Bandcamp orders were also imported and verified on September 22, preserving their Bandcamp shipped dates. The four website orders above were unchanged. [Bandcamp deployment record](BANDCAMP-ORDERS-2026-09-22.md) covers the separate merchandise-only feed, hourly reconciliation, source filter and review controls; digital Bandcamp sales are excluded.

The subsequent [Merch UI refresh](MERCH-UI-2026-09-22.md) changes the default from All to Unshipped. The All-default verification above describes the earlier recovery deployment.
