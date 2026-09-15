# Claude adversarial review: Merch Ops implementation

Actual Claude Code CLI reviewed the implementation with read-only Read/Glob/Grep tools. This is separate from the earlier draft review in MERCH-REVIEW-2026-09-14.md.

## Validation record

- 19 tests passed: real SQL functions executed in PGlite, webhook/business logic, direct Ops route authorization. No live database writes. PGlite is a single connection and does not prove multi-connection production concurrency.
- TypeScript passed. Changed-file ESLint passed with warnings (plain-img project convention, preexisting unused release props, a test destructuring variable).
- Production build passed using `npm run build -- --webpack`; default Turbopack hit a sandbox CSS worker restriction. Build confirms `/shop` revalidates every minute.
- Desktop and 390px mobile browser checks passed with synthetic API fixtures: CSV download, manual adjustment, product editor, no horizontal overflow or page errors.
- An extra browser test reproduced double stock deduction risk when save succeeded but refresh failed. The final behavior distinguishes a confirmed save from an unknown POST outcome: confirmed saves reset the form even if refresh fails; uncertain responses retain the key for retry. Both paths pass in tests/merch-browser.cjs (see tests/MERCH-BROWSER.md).
- Read-only Shopify import found 13 products, 33 variants, 44 image references; no Supabase import or schema application performed.
- Preview environment variable names checked: MERCH_BACKEND absent. No checkout backend activation performed.
- Live Stripe/webhook settings, deployed same-origin writes, actual Pirate Ship upload/label and real opening stock remain rollout gates.

## First implementation review (verbatim)

I've finished reading the implementation and cross-checked each suspected defect against the code. Writing the report now.

# Pre-deploy review: merch ops on `feature/merch-ops`

**Verdict first.** I found no P0 and no P1 defect in the durable order path. The transaction design holds up: session-level idempotency, advisory lock per payment intent, ordered row locks, block-before-order for out-of-order refunds, and export atomicity all check out against the SQL and the tests exercise the real migration. A flag-off preview deployment to `dev` is safe. Enabling `MERCH_BACKEND=supabase` has no code blocker, but it has three external setup gates and a handful of P2 items I would fix before the first live order.

## Flag-off preview: safe

With the flag unset I traced every new code path a request can hit:

- Checkout uses the Shopify variant lookup and the old `variants` metadata. The only behavior change is `normalizeCart` (20 lines, 10 per item, duplicate lines merged), which is harmless.
- The webhook only enters the merch branch for refunds/disputes and for sessions tagged `fulfillment_backend=supabase`. With no such sessions, `physicalIntent` returns false and the legacy handler runs unchanged. The one new cost is a Stripe sessions-list call before every refund; a Stripe outage there yields a 503 retry, not a lost event.
- Nothing reads merch tables until a request reaches `/ops/merch` or `/api/ops/merch`, which fail with a visible error rather than crashing the site.
- `/shop`, `/shop/[handle]`, `ShopStrip`, `/api/shopify-product`, and the health check all route through the storefront switch to the legacy lib.

## Confirmed defects (all P2)

**1. Email failure turns into an infinite webhook retry.** `src/app/api/webhooks/stripe/route.ts:75` awaits `confirmMerchOrder` inside the try that maps any throw to a 503, and `src/lib/merch/email.ts:16` throws on any Resend error. A permanent failure (recipient on Resend's suppression list, 422 validation error, domain misconfiguration) makes Stripe retry that event for days even though the order was durably written. Stripe warns about, and can eventually disable, an endpoint that keeps failing, which would then affect digital purchases. The existing digital handlers deliberately swallow email errors and alert instead (`route.ts:109-111`, `src/lib/email.ts:214-240`). Fix: keep the 503 for `processMerchEvent` failures only; wrap `confirmMerchOrder` in its own try, log, call `sendPurchaseFailureAlert`, and return 200. The order card already shows "not recorded as sent".

**2. `/shop` is prerendered at build time.** `src/app/shop/page.tsx` has no `dynamic` or `revalidate` export, and the local build produced `.next/server/app/shop.html`. This is pre-existing behavior with Shopify, but after cutover stock, prices, visibility and sold-out badges edited in Ops will not appear on the grid until the next deploy. The product page and the homepage strip are fine. Fix: `export const revalidate = 60` on the shop page, matching the other catalog pages.

**3. Dispute on a Shopify-era physical order goes silent once the flag is on.** `src/lib/merch/webhook.ts:43` treats any `type: physical` session as merch-owned when the flag is set. For an order that predates the migration there is no `merch_orders` row, so `block_merch_payment` writes a block row and returns true, the legacy handler at `route.ts:144` never runs, and no alert email is sent. Chargebacks have response deadlines. Fix: have `block` return the number of orders updated and fall through (return false) when it is zero, or always send `sendPurchaseFailureAlert` on `charge.dispute.created`. For merch-owned orders the daily health cron does email within 24 hours, so this only matters for the pre-cutover backlog.

**4. Legacy in-flight sessions lose the variant title.** `src/lib/merch/webhook.ts:27-31` snapshots `variant_title: "Default Title"` and an empty SKU for sessions created before cutover. Stock is deducted from the correct variant, but the Ops order card and the CSV "Items" column show "1 x Shirt" with no size, so staff can ship the wrong variant. The window is at most 24 hours of Stripe session lifetime. Fix: look up title and SKU from `merch_variants` by id inside `legacyItems`, or time the cutover for a quiet hour and manually check any order whose items show "Default Title" on a multi-variant product.

**5. Image uploads over about 4.5 MB fail with an unreadable error.** `src/app/api/ops/merch/image/route.ts:8` and the rollout doc advertise 10 MB, but Vercel functions cap request bodies at 4.5 MB, so the platform returns a 413 HTML page and `MerchDashboard.tsx:153` throws on `response.json()` with an empty message. Fix: cap at 4 MB in the UI and route, and update the copy. The import script uploads directly to Supabase and is unaffected.

## Documented choices, not defects

- No cart reservation; paid shortage held with `inventory_issue` (`record_merch_order` lines 136-140).
- Refunds never restock; stock stays deducted for a refunded or disputed order.
- Test orders consume `order_number` values and are never emailed, exported, or shipped.
- The health check throws while any live order is on hold, so the daily cron emails until staff clear it.
- Phone is always empty because checkout does not enable `phone_number_collection`. Existing behavior, but the rollout doc's "map Phone" step will map a blank column.
- The `merch_checkouts` table grows one row per checkout attempt and is never pruned. Trivial at this volume.
- Uncontrolled fulfillment form inputs keep stale defaults if another staff member changed the order between loads. Refresh fixes it.

## Verified sound (so you do not need to re-check)

- Retry and duplicate delivery: `stripe_session_id` unique plus the advisory lock on the payment intent; a `checkout.session.completed` and a later `async_payment_succeeded` for the same session record once.
- Rollback then retry: the whole RPC is one transaction; the test with a failing trigger proves order and ledger roll back together.
- Refund before order: block row is consulted at insert time and the later partial refund cannot downgrade a full refund.
- Price and quantity tampering: only `variantId` and `quantity` are read from the client; snapshot sum is re-verified against `amount_subtotal` at webhook time, which is correct even with promotion codes since Stripe's subtotal is pre-discount.
- Export: mixed batch rolls back, same key re-issues the same set, a new key on an exported order requires the explicit re-export flag, and shipped orders are never exportable.
- Auth: both the proxy and every route check the shared password with a constant-time compare; mutations require same-origin. Anon and authenticated roles are revoked on every table and function, and the test asserts it.
- Success page: the client only receives two booleans; digital cart items survive a physical purchase; the `hydrated` guard prevents the empty-cart race.
- CSP already allows `*.supabase.co` for images, so Storage-hosted product photos render.
- The appended section in `supabase-schema.sql` matches the standalone migration function for function.

## External setup gates before enabling the flag

These are not code problems and cannot be verified from the repo:

1. Run the schema migration, then the storage migration, then the dry-run import, then apply. If `/shop` reports a missing relationship right after migrating, PostgREST needs a schema reload.
2. Confirm the Stripe endpoint subscribes to all four event types and that the test-mode endpoint points at the preview host.
3. Verify one same-origin mutation on the deployed preview (an inventory adjustment on a test product) before relying on Ops, because the Playwright run mocked the API and the origin check has only been tested in the negative direction.
4. Confirm Pirate Ship accepts two-letter country codes in the import mapping; the CSV emits ISO codes.

Per the project audit rules, do not validate a purchase against the shared Supabase from `dev`. The rollout doc's isolated test-project instruction is the right path.

## Bottom line

No P0/P1 blockers. Fix items 1 and 3 before the first live order since they affect webhook health and dispute visibility; items 2, 4 and 5 are small and can ride along. Flag-off deployment to `dev` is safe today.


## Fixes submitted for follow-up

1. Isolated receipt/alert failures from durable webhook processing; added truthful admin alerts and live dispute notifications even for old physical orders.
2. Added shop revalidation every 60 seconds.
3. Matched in-flight legacy Stripe lines to imported products by captured product name, variant description and quantity, preserving size/SKU without assuming line order. Ambiguous matches require reconciliation.
4. Capped Ops image uploads at 4 MB with understandable errors, retaining direct-import 10 MB support.
5. Fixed the browser-discovered inventory retry issue and unavailable-option fallback in ProductDetail.
6. Preserved imported tags and existing stock across catalog updates.

## Second Claude review (verbatim)

All six claimed changes are verified against the working tree, including untracked files. Report follows.

**Verdict.** No P0 and no P1. All five findings from my first report are resolved in code. Flag-off preview on `dev` is still safe. Two P2 items remain, one of them introduced by the retry-key fix.

**Original findings**

1. Email failure causing infinite 503 retry: resolved. `src/lib/merch/notifications.ts:10` runs after the durable write, catches confirmation and alert failures, and never throws into the 503 path. The test at `tests/merch.test.ts:60` proves the order and stock survive both outages.
2. `/shop` prerendered: resolved, `src/app/shop/page.tsx:6`.
3. Silent dispute on Shopify-era orders: resolved. `notifications.ts:12` alerts on every live dispute once `processMerchEvent` returns true, which with the flag on covers sessions with no `merch_orders` row. Test events do not email.
4. Legacy sessions losing variant title: resolved. `src/lib/merch/legacy.ts:7` matches captured Stripe product name plus description against the imported catalog and snapshots real title and SKU. The legacy checkout branch at `src/app/api/checkout-physical/route.ts:54` emits name as the product title and description as the variant title, omitted for "Default Title", which is exactly what the matcher expects. Caveat: I could not diff against `main` from this review, so confirm the currently deployed production checkout emits the same fields before cutover.
5. Image upload over the Vercel body cap: resolved. Client cap at `MerchDashboard.tsx:150`, route cap at `image/route.ts:8` and `:11`, non-JSON fallback at `MerchDashboard.tsx:155`.

Also confirmed: `save_merch_product` preserves tags when the payload omits them, the canonical `supabase-schema.sql` merch section is byte-for-byte the standalone migration, the importer sends Shopify tags, `.merch-import/` is gitignored, and `ProductDetail.tsx:27` no longer falls back to the first variant.

**Remaining findings**

- **P2, retry key retained after a confirmed success.** `src/app/ops/merch/MerchDashboard.tsx:45-53` deletes the request key only after the refresh GET succeeds. The POST at line 46 already confirmed the mutation. If the refresh fails and staff click Refresh instead of retrying, the stale key stays for the page session. A later legitimate identical adjustment, same variant, delta, and reason, reuses it and the RPC returns the existing stock without applying. The UI then says "Saved." with no stock change. The key should be deleted as soon as the POST returns ok, and a failed refresh should show "Saved, but the list did not refresh" and return true. Keep retention only for the case where the POST outcome is unknown.
- **P2, permanent webhook failures have no alert.** Every throw inside `processMerchEvent` becomes a 503 at `src/app/api/webhooks/stripe/route.ts:84`. The reconciliation gate in `legacy.ts:18` and `webhook.ts:27` deliberately creates permanent failures for renamed or ambiguous legacy items, and a malformed snapshot or constraint error behaves the same way. Stripe retries for up to three days and then drops the event. Nothing in the app emails anyone. The only signal is the Stripe dashboard's failing-endpoint view. A best-effort `alertMerchIssue` keyed on the event id in the catch block would produce one email per event per day without changing the retry semantics.

**Deliberate limitations, not bugs**

- Full refunds on merch orders send no alert. The order goes on hold and the daily health cron emails. Refunds are staff-initiated.
- If the confirmation email sends but the `confirmation_email_sent_at` update fails, the alert text says the email failed. A resend within 24 hours is deduped by the Resend idempotency key. After that, a duplicate receipt would go out.
- `ReleaseInteractive.tsx:190` still adds the first variant for release-linked products. Correct for single-variant CDs and vinyl. Pre-existing.
- Test orders consume order numbers, legacy pre-branch sessions with duplicate lines fail the reconciliation gate on purpose, and the `import` after `revalidate` on `shop/page.tsx:7` is a lint nit only.

**Flag-off preview safety**

Safe. With `MERCH_BACKEND` unset the only new behavior on request paths is: `/shop` regenerates every 60 seconds from Shopify, the webhook makes one Stripe sessions-list call before every refund or dispute and returns 503 on a Stripe outage rather than swallowing it, and `/ops` links to `/ops/merch`, which shows a visible "Could not complete this request" until the migration runs. Nothing reads merch tables on a public page. Physical checkouts still cut real Shopify draft orders because dev shares production services, as documented.

**Activation gates, unchanged from my first report**

Schema then storage then dry run then apply. Confirm all four Stripe event subscriptions on both endpoints. Verify one same-origin mutation on the deployed preview, since the origin check has only been tested in the negative direction. Confirm Pirate Ship accepts ISO country codes. Do not validate purchases against the shared Supabase from `dev`.

I have not certified live Stripe, Supabase, Resend, or Pirate Ship integration. All evidence is static review and the PGlite fixture suite.


## Third Claude review (verbatim)

Both fixes are verified in the current files. No P0, no P1. Two P2 items, one about evidence rather than code.

**Verified**

- **Retry key lifecycle** (`src/app/ops/merch/MerchDashboard.tsx:46-59`): key deleted immediately after a confirmed 2xx. Refresh failure sets a "Saved, but the list did not refresh" status and returns true, so the inventory form resets and the product editor closes. CSV blob failure reports orders as exported and points to Re-export. Only a non-2xx or thrown fetch retains the key, and `busy` prevents a concurrent double submit. A second intentional identical adjustment gets a fresh UUID. Server side, the inventory and export RPCs remain key-idempotent, so retained keys on unknown outcomes stay safe.
- **Webhook permanent-failure alert** (`src/app/api/webhooks/stripe/route.ts:82-90`): alert only for `event.livemode`, keyed `processing-<event.id>` so Resend dedups to one email per event per day, wrapped in its own catch, and the 503 is still returned so Stripe retries. Message text does not claim the order is lost.
- Nineteen tests in `tests/merch.test.ts` match the "19 passing" claim.

**Remaining findings**

- **P2, the claimed browser tests are not in the repo.** No file outside `tests/merch.test.ts` references the dashboard, and there is no browser harness in devDependencies. The "confirmed save plus failed refresh resets the form" and "unknown POST retains key" checks were ad hoc and leave no artifact. `MERCH-IMPLEMENTATION-REVIEW-2026-09-14.md:11` still describes the superseded behavior (retain until refresh succeeds). Either commit the checks or correct the doc so the next reviewer does not trust a stale sentence.
- **P2 minor, contradictory UI on CSV download failure.** If the blob step fails but the refresh succeeds, the red "download failed" alert and the blue "CSV downloaded. Import it into Pirate Ship" status render together (`MerchDashboard.tsx:54` then `:58`). One-line fix: skip the success message when the download failed.

**Flag-off dev preview verdict:** safe to deploy. The only new flag-off behavior since the last report is the alert email on a livemode Stripe-outage 503 during refund or dispute handling, which is correct and bounded by the idempotency key. Migration, country mapping, deployed same-origin mutation, and live Stripe integration remain external gates, as stated.


## Final disposition

- All original code findings resolved and verified by Claude's follow-up reviews. No P0/P1 finding remains.
- The third report's CSV-message observation was based on a read just before the final change: action now tracks `downloaded` and only says CSV downloaded when the blob/download step succeeded. Otherwise it says Export saved and directs staff to Re-export.
- Browser tests are now committed as tests/merch-browser.cjs with setup instructions; both cases passed after the final changes. This validation record was corrected to describe the final key lifecycle.
- Checked `origin/main` checkout source: product_data.name is productTitle and description is the variant title (omitted for Default Title), matching the legacy reconciliation helper.
- Final webpack build passed, including TypeScript. Preview backend flag is absent. Database/schema import, stock counts, deployed mutation and live integration remain rollout gates; no activation is implied by the review.
