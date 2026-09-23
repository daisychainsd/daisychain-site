# Bandcamp physical orders in Merch Ops

## Scope and source audit

Physical Bandcamp merchandise joins website Stripe orders at `/ops/merch`. Standalone digital song and album sales are excluded. The existing Bandcamp integration was subscriber-only; this change adds a separate order feed using [Bandcamp's Merch Orders API v4](https://bandcamp.com/developer/merch), not its sales report.

The initial authenticated, full-history query returned **8 physical items across 8 payments**, all paid and already marked shipped by Bandcamp. Earliest order: November 11, 2025. The backlog import preserves those source ship dates. Customer details and import SQL stay outside Git under `~/Downloads/Daisy-Chain-Bandcamp-Orders-2026-09-22/`.

## Behavior

- `dc-email-api` exposes a read-only `/api/internal/bandcamp-merch`, protected by its existing `INTERNAL_SECRET`, using the configured Bandcamp account and OAuth cache. It performs no subscriber work or Bandcamp writes.
- The site reconciles this physical-only feed hourly at minute 25, independently of website Stripe reconciliation at minute 15. All history is checked so old unpaid payments and refunds are revisited.
- Items group by band ID + payment ID into one order. The database enforces unique source IDs and saves atomically. Source labels and a Website/Bandcamp filter identify orders in the shared dashboard.
- Initial shipping state comes from Bandcamp. Later syncs preserve manual Ops fulfillment, notes, tracking and shipment/export timestamps. Source shipping changes update orders that have not had an explicit manual fulfillment change in Ops. Refunds hold unshipped orders; previously shipped orders keep their shipment history. Ops shipping changes do not write back to Bandcamp or email customers.
- Pending, failed and refunded purchases cannot ship/export. Partial shipments, incomplete addresses and inconsistent totals start On hold. Review the Bandcamp item history before releasing a partial shipment, so already shipped items are not sent twice.
- Changed items/recipient/address/amount are flagged while retaining the original snapshot and applying payment changes. Ops lets staff review and accept the incoming snapshot with a note; stale reviews are rejected and accepted unshipped orders remain On hold until released. These failures return 503 and alert staff. No Bandcamp import deducts Supabase stock or changes the Shopify catalog.

Current limits: amounts are supported in USD; another currency fails visibly instead of being misvalued. Multiple destinations under one Bandcamp payment require manual splitting. Full-history scanning is appropriate for the current eight-order volume; revisit windowing with overlap and a separate refund sweep when volume grows.

## Validation

- 46 site tests pass: existing Stripe and database behavior plus Bandcamp grouping, rounding, replay, shipped backfill, manual-state preservation, partial shipments, payment holds, snapshot changes, auth, and failure handling.
- 2 `dc-email-api` tests pass: protected feed, physical-only API request, no cached/private error response.
- TypeScript and production builds pass for both apps. Scoped site lint has no errors (existing image warnings only).
- Browser checks pass for source filters, manual shipping, pending address review and desktop/mobile layouts using isolated fixture API responses.
- The migration is applied twice in isolated PostgreSQL/PGlite and preserves existing records. Public/anonymous roles cannot read customer orders or invoke the Bandcamp RPC.

## Activation checkpoint

The authenticated feed is deployed through [dc-email-api PR #1](https://github.com/daisychainsd/dc-email-api/pull/1), merged to main as `9ace837`. Production feed verification returned HTTP 200 with eight physical items and `Cache-Control: no-store`; an unauthenticated request returned 401.

**Production import verified September 22 (04:32 UTC September 23).** PD ran the combined setup/import SQL. The production database contains eight paid Bandcamp orders (all retain their Bandcamp shipped dates) and four website orders. A live read-only audit followed by `--apply` returned eight physical orders, zero missing, zero newly imported and zero failures. Before/after comparison confirmed all twelve orders' shipping states, tracking, notes, item snapshots and addresses were unchanged; the complete website records were unchanged. No Bandcamp order was flagged for snapshot review. Anonymous access to `accept_bandcamp_order` returned permission denied (42501).

[Site PR #26](https://github.com/daisychainsd/daisychain-site/pull/26) merged to main at 2026-09-23 04:33:16 UTC as `3272723e5d7827d1e05a3ffaa436fd4dbb0595e2`. Vercel production deployment `dpl_CvUi7FAHZEtZVymQrh4i4MGbofTy` is live. Authenticated browser checks verified All=12, Bandcamp=8 and Website=4, with the eight Bandcamp orders shipped. The Vercel cron runner triggered `/api/cron/bandcamp-orders` at 2026-09-23 04:38:08 UTC; production runtime logs show HTTP 200. The job is registered at `25 * * * *`. This was a manual invocation through Vercel’s cron runner, not a claim that the next scheduled hourly run has already occurred. The schema/import step is complete; do not ask PD to run setup SQL again.

Related docs are merged in [Ops PR #2](https://github.com/daisychainsd/daisychain-ops/pull/2), [system map PR #2](https://github.com/daisychainsd/daisychainsd/pull/2) and [organization profile PR #2](https://github.com/daisychainsd/.github/pull/2).



## Claude adversarial review

Claude reviewed both repositories and then reviewed the fixes. Follow-up verdict: **SHIP**, with no remaining P1 code findings. Initial findings led to the pending-snapshot review/accept flow, exact-snapshot concurrency check, database export guard, and propagation of later Bandcamp shipping updates to untouched Ops orders. The review's P3 email/phone refresh and unpaid-hold explanation were also addressed. The browser harness now exercises the review form through its API request.

The backlog import/replay activation check is now closed by the production verification above. The combined SQL was generated from the exact application normalizer, applied twice in isolated PostgreSQL/PGlite, and replayed against all eight captured physical purchases without new inserts or review flags. Production SQL setup is complete and its replay also passed.

Multi-item monetary semantics cannot be verified against current live data because every existing Bandcamp payment has one purchased item. Inconsistent captured totals are held; compare the first real multi-item payment against Bandcamp before releasing a monetary hold. Full reports and dispositions are in [the review record](BANDCAMP-ORDERS-REVIEW-2026-09-22.md).
