# Claude adversarial review: physical Bandcamp orders

Actual Claude Code read-only review of the site and email-service changes, September 22, 2026. See [the activation record](BANDCAMP-ORDERS-2026-09-22.md) for dispositions and verified deployment status. The reviewer could not read the private backlog SQL or run live requests; statements about its import were assumptions at review time. The final dispositions below record our completed production verification.

## Initial review

Review complete. I read every new and modified file on both sides plus the base schema they extend. Below are the concrete findings, then the verdict.

## Verdict: SHIP, with one required follow-up

The migration and the import of the 8 already-shipped orders are safe. Website Stripe behavior is intact. Two defects need fixing before the queue is trusted for the first **unshipped** Bandcamp order, but neither can corrupt the rows being imported today.

## P1: a changed Bandcamp snapshot locks the order forever

`scripts/merch-bandcamp-2026-09-22.sql:29-44` recomputes `changed` on every hourly sync against the stored snapshot, but never updates that snapshot. `update_merch_order` at line 73 then refuses every transition except on hold, and `MerchDashboard.tsx:144` disables the button. Nothing in the codebase clears `review_needed`.

A buyer correcting an address typo on Bandcamp before shipment is the common trigger. Effects:

- The order can never be exported or marked shipped from Ops. Only a manual database edit frees it.
- `bandcamp.ts:145` reports it as a failure on every run, so the cron returns 503 every hour and emails an alert daily (`bandcamp-cron.ts:11-18`).

Smallest safe correction, inside the `if found` branch, before the existing `update`:

```sql
if changed and saved.exported_at is null and saved.fulfillment_status <> 'shipped' then
  update merch_orders set items=payload->'items', shipping_address=payload->'shipping_address',
    customer_name=payload->>'customer_name', email=payload->>'email', phone=payload->>'phone',
    subtotal_cents=(payload->>'subtotal_cents')::integer, shipping_cents=(payload->>'shipping_cents')::integer,
    tax_cents=(payload->>'tax_cents')::integer, total_cents=(payload->>'total_cents')::integer
    where id=saved.id;
  changed := false;
end if;
```

Nothing has been packed for those rows, so Bandcamp's current data is the right data. For exported or shipped rows the flag is legitimate, but staff still need a release path: store the incoming snapshot as `source_data.pending` and let `update_merch_order` adopt it when the order is released with a non-empty note, mirroring the existing `resolve_stock` pattern. Also only push the `bandcamp.ts:145` failure when `changed` goes false to true, so the cron does not 503 hourly.

## P2 findings

- **Server-side export ignores the review flag.** `export_merch_orders` in `scripts/merch-schema-2026-09-14.sql:214-222` checks payment, stock and address but not `source_data->>'review_needed'`. Only the client `canExport` in `csv.ts:27` does. A dashboard loaded before the sync exports the stale address. Fix: recreate the function in the migration with `or row.source_data->>'review_needed' = 'true'` added to the guard, and mirror it in `supabase-schema.sql`.

- **Shipping done on Bandcamp after import never reaches Ops.** `merch-bandcamp-2026-09-22.sql:38-41` keeps the saved fulfillment status unconditionally. A future order imported as new, then marked shipped in Bandcamp's UI, stays exportable in Ops and gets a second label. Fix: add a case branch that promotes to shipped only when `payload->'source_data'->'ship_dates'` is distinct from `saved.source_data->'ship_dates'` and the row is new or exported, and set `shipped_at = coalesce(saved.shipped_at, (payload->>'shipped_at')::timestamptz)`. Comparing ship dates distinguishes "Bandcamp newly shipped" from "staff deliberately unshipped", so the test at `tests/bandcamp.test.ts:57-69` still holds.

- **Multi-item totals are unverified against the real API shape.** `bandcamp.ts:74` sums `shipping`, `tax` and `order_total` per row. If Bandcamp repeats payment-level values on each sale item, multi-item orders will be inflated. The guard at line 83 catches the mismatch and holds the order with a note, so this is safe, but confirm on the first multi-item order. All 8 current orders import as shipped, so it cannot bite today.

## P3 notes

- `bandcamp.ts:46-49` throws outside the per-order try when a sale item id is invalid or appears twice with different data. One bad row aborts the whole feed and imports nothing. Push a failure instead.
- Pending payments that later clear stay on hold with no visible reason (`merch-bandcamp-2026-09-22.sql:40-41`, dashboard shows "paid · on hold"). Staff can release manually. Consider showing the reason from `source_data`.
- Failed payments are imported and sit in the Unshipped view forever. Consider skipping `failed` rows in `normalizeBandcampOrders`.
- Once `MERCH_BACKEND` is enabled, `ops-health.ts:219` will fail the daily health check whenever any Bandcamp order is on hold. Expected, but noisy.

## Verified correct

- **No duplicates.** Unique index on `(source, source_order_id)`, advisory lock and `for update` at `merch-bandcamp-2026-09-22.sql:8,27-28`. Concurrent cron and script cannot double-insert.
- **No silent missing orders.** Normalization failures are reported, the cron returns 503, and an alert sends. `existing()` paginates fully.
- **Manual state preserved.** The update branch never touches `notes`, `tracking_number`, `shipped_at` or a shipped status. Refund transitions hold unshipped rows only; a staff-released partial refund is not re-held because the status no longer changes.
- **Website Stripe path intact.** `record_merch_order` inserts with the default source and a non-null session id, so the new check constraint passes. `block_merch_payment`, `getOrderBySession` and `annotate` match on Stripe columns that Bandcamp rows leave null. The test at `tests/merch.test.ts:112` still matches the reworded hold message, and `tests/merch.test.ts:372-377` enforces schema parity.
- **Migration idempotent and correctly named.** `merch_orders_payment_status_check` is Postgres's auto-generated name for the inline column check, confirmed by the PGlite test inserting `pending`.
- **Permissions and leaks.** Both RPCs are revoked from public, anon and authenticated, table RLS is untouched, and the test at `tests/bandcamp.test.ts:110-120` proves it. The email API route returns 401 without the secret and masks provider errors as 503. Alert emails carry only `bandId:paymentId` plus error text, never buyer data.

Next step: apply the P1 snapshot adoption and the export guard as a small follow-up migration before the first unshipped Bandcamp order lands.


## Follow-up review

**Verdict: SHIP.** The three prior findings are closed in code and covered by tests. No P1 remains. One P2 is an activation check, not a code change.

**Prior findings, verified**

- **Changed snapshots now have a release path.** The sync RPC stores the incoming payload as `source_data.pending`, flags `review_needed`, and holds unshipped orders. The dashboard renders the pending name, address, items and total behind a "Review updated Bandcamp details" disclosure and posts the exact pending object back. The accept RPC compares it with `is distinct from` against the stored jsonb, so a re-sync between page load and accept fails with "changed again". Accepted orders land on hold; the replay test confirms the next sync produces no failure. Idempotent retry is covered.
- **Export guard is in the database.** `export_merch_orders` now rejects `review_needed = 'true'`, and the manual-update RPC blocks any transition except to hold. Both are NULL-safe for website rows whose `source_data` is `{}`. The test forces the flag via SQL and asserts the RPC raises.
- **Later Bandcamp shipments propagate.** `source_data` is replaced on every sync, so the `ship_dates` comparison is edge-triggered. When ship dates change on an untouched, unchanged order, the source status and shipped timestamp apply. An exported order that Bandcamp reverts to unshipped goes to hold rather than back to the queue. `fulfillment_manually_updated` is set only for Bandcamp orders on a real status transition, and the SET clause correctly reads the pre-update column. Refunds still override manual state via the third branch.

**Remaining issues**

- **P2, activation only.** The eight backlog orders were imported by `setup-bandcamp-orders.sql`, which lives outside git. If that script wrote `items` or `source_data` in a different shape from the normalizer output, the first `--apply` or cron run will flag all eight as review-needed and return 503 until each is accepted. The dry run cannot detect this because it only reports missing IDs. Watch the first apply and, if all eight fail with the "changed" message at once, treat it as an import-shape mismatch and accept each rather than hunting for real changes.
- **P3.** A pending payment that later becomes paid stays on hold with no visible reason. The dashboard shows "paid" and "on hold", and the notes never mentioned the pending hold. Staff can release it manually.
- **P3.** Email and phone are not part of the change detection, so an email-only change on Bandcamp is never applied. The Pirate Ship CSV would carry the old email for shipment notifications.
- **P3.** Multi-item monetary semantics remain unverified, as you noted. If the feed repeats payment-level shipping, tax or total on each row, the order is held with the totals note, but the stored total is wrong. Releasing it manually exports that total to Pirate Ship. Verify against the first real multi-item payment.
- **P3, docs.** CLAUDE.md still says later runs "preserve manual Ops shipping". OPERATIONS.md line 142 has the accurate behavior. The browser harness does not exercise the review form, so the dashboard-to-RPC snapshot round trip is only covered by the unit test posting the stored pending object directly.

## Final dispositions

- Snapshot lock, DB export guard, and later source shipments: fixed and tested.
- Email/phone corrections and unpaid hold explanations: added after follow-up.
- Browser form review: exercised in the final isolated browser run.
- Import-shape check: exact generated SQL applied twice and normalizer replayed against all eight captured orders in isolated PostgreSQL; production import and replay are now verified: eight Bandcamp orders, zero new inserts, zero review flags; all shipping records and the four website orders preserved.
- Multi-item monetary semantics: no such live transaction exists yet; documented verification at first occurrence.
- Failed physical payments remain visible on hold as part of all-order history, and cannot ship/export.
