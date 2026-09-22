# Claude adversarial review — physical order recovery

Date: September 22, 2026. Requested by PD. Two independent Claude Code CLI runs reviewed the standards and specification/correctness axes, followed by a third adversarial verification pass. Initial fixed point: `origin/main` (`698218565d4bdd7dcd28f4b7f8d91576105d8aa4`) against commits `462e99f`, `450dc46`, `5bfcdf9`. Reviews were read-only, with file-search tools and no credentials, customer exports or production access. Reviewer line references are snapshots and can drift; the dispositions below identify the current files.

## Standards

Initial result: five confirmed findings (canonical schema drift, success-page backend gate, operational documentation drift, missing reconciliation tests, recovery-export ignore rules). All addressed in the working changes. No formatting-only findings counted.

## Spec and correctness

Initial result: seven confirmed findings (reconciliation insert race, missing physical refund alerts, resolved-dispute reblocking, repeat-export risk after undoing shipping, canonical schema drift, success-page backend gate, missing reconciliation tests). Initial recommendation: no-ship until the race and refund alerts were fixed.

## Disposition

| Finding | Resolution |
|---|---|
| Reconciliation insert race | `record` returns the SQL `created` flag. Only the winning inserter is counted/annotated; PostgreSQL-backed race test proves a webhook winner retains its notes. |
| Physical refund notifications lost | Live full/partial refunds alert staff after persistence; test events stay silent. |
| Resolved disputes repeatedly blocked | Reconciliation checks current dispute statuses, not only `charge.disputed`. Won/closed disputes do not recreate holds. Existing holds require verified manual administrative reconciliation; no automatic release to shipping. |
| Undoing shipment could enable another ordinary export | Previously exported orders return to On hold when marked unshipped, with visible instructions to check the existing Pirate Ship label. Browser tests cover the sequence. |
| Canonical schema still required tracking | Fresh-install function matches the applied optional-tracking migration; test compares the two function bodies. No additional production migration is needed for these review fixes. |
| Success page ignored saved Shopify-era orders | Saved-state lookup applies to every paid physical session, independent of catalog metadata. |
| No reconciliation/cron coverage | Injectable dependencies plus real PostgreSQL tests cover iterator traversal, replay, concurrent webhook wins, refund escalation, reviewed partial refunds, resolved disputes, failed imports, dry-run behavior and protected cron failures. |
| Docs described old Shopify-only fulfillment | Rewrote site README, OPERATIONS, CLAUDE and merch rollout; updated Ops README/map/SOP, system map/onboarding, and org profile. Historical records explicitly remain historical. |
| Customer recovery exports could enter Git | Ignore rules cover recovery JSON, CSV and combined setup SQL at any depth. Customer files remain outside Git. |
| Different daily cron failures could share one alert key | Alert keys include a failure fingerprint; messages identify failed sessions. |

## Verification

31 automated tests pass; TypeScript and scoped lint pass (existing warnings only); production webpack build passes. Browser checks use isolated responses, not real shipment mutations. Live database/API verification confirmed the four recovered orders. Full-history scan cost is acceptable for the verified 55 completed sessions/four physical orders; it must be revisited as volume grows. No shortened time window was added, because that would silently exclude backlog.

## Follow-up verdict

**Claude verdict: SHIP. No remaining P1/P2 findings.** The follow-up confirmed both blocking fixes and traced the SQL concurrency paths. Won/closed disputes deliberately remain held until a developer reconciles both payment tables; the procedure is in OPERATIONS.md and the test now covers a previously blocked order, both-table reset, rerun and subsequent partial refund. Other residuals are low-priority operational limits: full-history cost at larger volume, a conservative note on fresh cron-recovered orders, and a possible missing recovery note if annotation fails after insertion. The paid order itself remains durable.

## Original standards review

**Standards-axis review: physical order recovery (commits 462e99f, 450dc46, 5bfcdf9)**

Scope read: AGENTS.md, CLAUDE.md merch/cron/security rules, OPERATIONS.md, MERCH-ROLLOUT.md, ORDER-RECOVERY-2026-09-22.md, MERCH-IMPLEMENTATION-PLAN.md, all changed source, tests, and the unchanged files they touch.

## Confirmed findings

**C1. P1 — Canonical schema file not updated (migration drift).**
`supabase-schema.sql:389` still raises "A live order and tracking number are required". CLAUDE.md "Merch Ops replacement" states migrations are "also included in `supabase-schema.sql`". `scripts/merch-shipping-2026-09-22.sql` was not folded in, so a fresh environment or a disaster rebuild from the canonical file re-imposes mandatory tracking and diverges from production. Tests only prove the layered file order (`tests/merch.test.ts:47-48`). Fix: replace the function body in `supabase-schema.sql` with the 09-22 version.

**C2. P2 — Success page contradicts "every physical payment persists to Ops".**
`src/app/shop/checkout/success/page.tsx:13` only checks `merch_orders` when `metadata.fulfillment_backend === "supabase"`. With MERCH_BACKEND unset, `checkout-physical/route.ts:59` sets only `{type, variants}`, so every live buyer sees "We're finalizing your order" even after the order is saved. Fix: gate on `paid` alone; `paidPhysicalSession` already requires `type === "physical"`.

**C3. P2 — Operational documentation drift (CLAUDE.md rule: docs must reflect live behavior; OPERATIONS.md is the on-call reference).**
- `OPERATIONS.md:20,28` say the webhook creates Shopify draft orders; that path is deleted. `:34-40` omit `/api/cron/merch-reconcile`; `:83` Health panel list omits "Physical orders".
- `CLAUDE.md:44,154,161,177,424` describe draft-order creation / "MERCH_BACKEND selects order persistence"; `:764` Cron Jobs section omits the new hourly cron. `:175` documents `shopify-admin.ts` as active; nothing imports it now.
- `MERCH-ROLLOUT.md:22` "Orders → New" (dashboard default is now All); `:32` rollback text says only flagged sessions persist to Supabase.
Fix: one doc pass; keep the Shopify Admin section but mark it dormant per MERCH-REVIEW step 4.

**C4. P2 — Hourly production-writing cron has zero test coverage.**
`src/lib/merch/reconcile.ts` calls `stripe` and `createAdminClient()` directly with no dependency injection, unlike `processMerchEvent`. The severity ladder (`:414-417`), the notes stamp (`:424-426`) and the cron's 503/alert path are untested. CLAUDE.md requires `npm run test:merch` to exercise real transactions without live services. Fix: accept a `deps` parameter (reuse `MerchWebhookDependencies` plus a session iterator) and add tests for: existing partial-refund released by staff is not re-held; missing order imported with note; failure yields exit code 1.

**C5. P3 — Recovery output files not protected by `.gitignore`.**
`scripts/merch-reconcile.ts:66-71` writes customer names, emails and addresses to any `--output` path. `.gitignore:50` covers only `.merch-import/`. The doc says "never commit it" but nothing enforces it. Fix: ignore `recovered-orders.json` and `check-pirate-ship-before-shipping.csv`, or refuse paths under the repo root.

## Potential risks (not confirmed defects)

**R1. Misleading note on fresh orders.** If a webhook 503s just before :15, the cron records the order first and stamps "Recovered from Stripe. Shipping history unverified" (`reconcile.ts:424-426`). The confirmation email then depends on Stripe's retry. Consider stamping only when `session.created` predates the deploy, or skipping sessions younger than one hour.

**R2. Unbounded hourly Stripe load.** Every run lists all completed sessions and makes two Stripe calls per physical session (`reconcile.ts:399,409`), including orders already refunded or disputed. Trivial at four orders; add a `created[gte]` window or skip the payment-intent fetch when `existing.payment_status` is already terminal once the backlog is verified.

**R3. Unverifiable combined SQL.** The activation doc says PD ran a combined file from `~/Downloads`. It is outside the repo, so I cannot confirm it used `create or replace` (which preserves the service_role-only grant) rather than drop-and-create (which defaults EXECUTE to PUBLIC). One-line check in the SQL editor: `select proacl from pg_proc where proname = 'update_merch_order';` should not show `=X/`.

**R4. Alert dedupe by day.** `merch-reconcile/route.ts:134` keys alerts by date, so a failure fixed and re-broken the same day emails once. Acceptable; noting for on-call expectations.

## Verified clean

Webhook ordering rule (physical before `processed_stripe_events`, 503 on failed write) holds at `route.ts:64-89`. `/api/ops/merch/*` auth and no-store unchanged. `deduct_inventory` parameter already existed in the 09-14 schema, so no new migration is needed for it. No customer data appears in alert emails or cron logs.

**Counts:** 5 confirmed findings (1 P1, 3 P2, 1 P3), 4 residual risks.

## Original spec/correctness review

# Physical order recovery review (spec/correctness)

Scope: commits 462e99f, 450dc46, 5bfcdf9 vs `origin/main`. Read-only; code inspected, tests read, nothing run against live services.

## Confirmed issues

**1. Medium. Reconciliation ignores the RPC's `created` flag and races the webhook.**
`src/lib/merch/reconcile.ts:404-428`. The cron checks `getOrderBySession`, then does a Stripe `paymentIntents.retrieve`, then calls `record`, then stamps a note with `.eq("notes","").eq("fulfillment_status","new")`. `record_merch_order` returns `created:false` when the row already exists, but that return is discarded.
Failure scenarios:
- Webhook inserts the order between the existence check and `record` (the cron fires at :15 every hour, and a PI retrieve adds latency). Result: a fresh live order gets the note "Recovered from Stripe. Shipping history unverified: check Pirate Ship before shipping" and `imported` reports 1. Misleading, and it tells PD to check Pirate Ship for an order that was never shipped.
- Webhook is 503-ing (DB flake) and the cron wins first. The order enters Ops with the recovery note and no confirmation email. Stripe's retry later sends the email (fine), but the note stays.
Fix: return the RPC result from `record`, and only apply the note and increment `imported` when `created === true`. Better: only add the "check Pirate Ship" note for sessions created before the deploy date; new orders should never carry it.

**2. Medium. Full refunds on physical orders are now silent.**
`src/app/api/webhooks/stripe/route.ts:68-79` returns early whenever `processMerchEvent` handles a refund, and `physicalIntent` (`src/lib/merch/webhook.ts:36-39`) now matches every physical session, not just supabase-backend ones. So `handleRefundOrDispute` (which emailed an alert on main) no longer runs for physical orders, and `notifyMerchEvent` (`src/lib/merch/notifications.ts:12`) alerts only on disputes. A `charge.refunded` puts the order on_hold in Ops with no email. This is a regression relative to `main`.
Fix: in `notifyMerchEvent`, alert on `charge.refunded` when `event.livemode`, using `event.id` as the idempotency key.

**3. Medium. The hourly cron makes a disputed order permanently unshippable.**
`src/lib/merch/reconcile.ts:409-418` re-blocks whenever `charge.disputed` is true and severity is above the stored status. Stripe leaves `charge.disputed = true` after a dispute is won. `update_merch_order` (`scripts/merch-shipping-2026-09-22.sql:94`) rejects any status but on_hold for a disputed order, and there is no Ops path to reset `payment_status`. If PD resets it by SQL after winning, the next cron run reverts it. The schema rule is pre-existing, but the cron turns it from "manual SQL fix" into "sticky forever".
Fix: only call `block` during reconciliation when `!existing` (initial import), and let webhooks own later transitions. Or inspect `charge.dispute.status` and skip `won`/`warning_closed`.

**4. Low. Mark unshipped after export re-arms the CSV export.**
`src/app/ops/merch/MerchDashboard.tsx:139` always toggles to `new`; the SQL update never clears `exported_at`, and `next_status = 'exported'` is rejected unless already exported (`merch-shipping-2026-09-22.sql:93`). An exported → shipped → unshipped order becomes `new` with an "Exported …" timestamp still shown, is eligible for plain Export again, and can produce a second Pirate Ship label row. Fix: allow `next_status = 'exported'` when `row.exported_at is not null`, and have the toggle send `exported` in that case.

**5. Low. Canonical schema drifted.** `supabase-schema.sql:389` still contains the tracking-required `update_merch_order`. A fresh environment built from it will reject "Mark shipped" without tracking. Fold the 09-22 body in.

**6. Low. Success page never shows "saved" on the active path.** `src/app/shop/checkout/success/page.tsx:13` checks `saved` only when `fulfillment_backend === "supabase"`. With `MERCH_BACKEND` unset every buyer sees "We're finalizing your order." Drop the backend condition.

**7. Low. No tests for the reconciliation path.** `src/lib/merch/reconcile.ts` and the cron route have zero coverage; the 23 tests never exercise pagination, the missing/imported accounting, the note stamping, or the severity logic. Issue 1 would have been caught by a test that pre-inserts the order via `processMerchEvent` and then runs `reconcilePhysicalOrders(true)` with a mocked `sessions.list` iterator, asserting `imported === 0` and `notes === ""`.

## Potential risks (inspected, not triggered by current data)

- **Permanent per-session failure loop.** `capturedPhysicalItems` (`src/lib/merch/legacy.ts:36`) throws on non-divisible `amount_subtotal`, and `orderPayload` throws on non-USD or a subtotal mismatch. Any such session fails hourly forever and never enters Ops. The cron alert is keyed `reconciliation-<date>`, so after the first day's email each later day gets exactly one more. Not wrong, but a stuck order surfaces only as a daily generic email. Consider including failing session ids in the alert text.
- **Alert dedupe hides distinct failures.** Same date key means a second, different failure later the same day is swallowed by Resend idempotency (`src/app/api/cron/merch-reconcile/route.ts:134`).
- **Full history scan every hour.** One list page per 100 completed sessions plus one PI retrieve per physical order. Fine at 55 sessions and four orders; worth a `created.gte` window in a year or two.
- **Webhook fall-through.** If `processMerchEvent` ever returned `false` for a physical session, `route.ts:130-134` would route it to `handleDigitalPurchase`. Currently unreachable because the `metadata.type` check is identical in both places.

## Verified as correct

Session-level idempotency via advisory lock plus `stripe_session_id` unique; manual `shipped`/`notes` survive repeated `record` calls (test at `tests/merch.test.ts:218-233` covers this); legacy orders never touch inventory (`deduct_inventory=false`); the cron route rejects missing/incorrect `CRON_SECRET`; Ops mutation routes still require Basic auth plus same-origin; CSV export still excludes on_hold, refunded, disputed, test and address-incomplete orders; `block_merch_payment` never demotes a shipped order to on_hold.

## Recommendation

**No-ship as-is. Ship after fixing 1 and 2** (both are small: use the RPC's `created` flag; add a refund alert). Decide on 3 explicitly; if you accept "disputed orders never ship from Ops", document it. Items 4 to 7 can follow.

Missing verification before merge:
1. Confirm in the Stripe dashboard that the production webhook endpoint is subscribed to `charge.refunded` and `charge.dispute.created`; the code path is otherwise dormant.
2. After deploy, trigger `/api/cron/merch-reconcile` once manually via `www.daisychainsd.com` with the secret and confirm `imported: 0`, `failures: []`, and that no existing order's `notes` changed.
3. Place one test-mode physical purchase on the dev preview and confirm a `livemode=false` row appears in Ops and the success page behaviour is acceptable.
4. Add the reconciliation unit test described in item 7.

## Original Claude follow-up

**Conclusion: ship.** Both blocking findings from the first review are fixed in the working tree, the concurrency logic holds under the scenarios I traced, and the residuals are P3.

## Initial findings, status

**Adversarial 1 / Standards C4, R1: reconciliation ignored `created` and raced the webhook.** Resolved. `src/lib/merch/webhook.ts:28-33` returns `{created}` and throws if the RPC returns no boolean. `src/lib/merch/reconcile.ts:75-80` skips counting and annotation unless `created` is true. The race test at `tests/merch.test.ts:292-299` inserts via the webhook inside `find()` and asserts no import, no note, one row, stock decremented once. Residual: a cron-first import of a fresh order that the webhook 503'd still gets the "check Pirate Ship" note. The webhook retry still sends the confirmation, because `record` returns `created:false` and the route continues into `notifyMerchEvent`. Cosmetic.

**Adversarial 2: physical refunds silent.** Resolved. `src/lib/merch/notifications.ts:14-16` alerts on live `charge.refunded` keyed by `event.id`, distinguishing full and partial. Test at `tests/merch.test.ts:339-346`.

**Adversarial 3: hourly cron makes a won dispute permanently unshippable.** Partially resolved. `currentPaymentBlock` (`reconcile.ts:19-23`) lists disputes and returns null for `won` / `warning_closed`, so the cron no longer re-holds after a manual reset. Still open: nothing ever lowers `payment_status` from `disputed`. `block_merch_payment` only escalates (`supabase-schema.sql:313-316`), and `update_merch_order` rejects any non-hold status for a disputed row (`:379`). The test at `tests/merch.test.ts:325-337` asserts `paid` only because the order was never blocked in the first place. Additionally, a manual SQL reset of `merch_orders.payment_status` leaves `merch_payment_blocks` at `disputed`, so any later partial refund re-escalates to `disputed` through the conflict rule. Document "won disputes need a SQL reset of both tables" or accept it.

**Adversarial 4: mark-unshipped re-arms export.** Resolved by design. `MerchDashboard.tsx:139` sends `on_hold` when `exported_at` is set, with explicit copy at `:142`. From on hold, staff must consciously choose Unshipped before Export works again. Acceptable.

**Adversarial 5 / Standards C1: canonical schema drift.** Resolved. `supabase-schema.sql:371-397` matches `scripts/merch-shipping-2026-09-22.sql`, and `tests/merch.test.ts:362-367` pins the two bodies equal.

**Adversarial 6 / Standards C2: success page never shows saved.** Resolved. `success/page.tsx:13` checks `merch_orders` for every paid physical session.

**Adversarial 7 / Standards C4: no reconciliation tests.** Resolved. `ReconciliationDependencies` is injected (`reconcile.ts:9-17`), cron logic is extracted to `reconcile-cron.ts` with injected `run`/`alert`. Tests cover pagination past 100, paid-only filtering, replay safety, the webhook race, refund holds preserving a staff release, partial failure isolation, dry-run never writing, and cron auth/503/fingerprint.

**Standards C3: doc drift.** Resolved for the operative sections. `OPERATIONS.md:27,39,49,83`, `CLAUDE.md:161-175,772`, `MERCH-ROLLOUT.md:43` reflect the current path and the hourly cron. Remaining "draft order" mentions are inside dated session notes flagged as historical.

**Standards C5: recovery exports unignored.** Resolved. `.gitignore:52-55` ignores both output filenames globally plus `setup-ops-orders.sql`.

**Risks R2 (full history scan hourly), R3 (unverifiable combined SQL grant), R4 (daily alert dedupe).** R4 resolved via fingerprint at `reconcile-cron.ts:20-22`; the test asserts distinct keys for distinct failures. R2 and R3 unchanged and acceptable.

## Concurrency and state verification

I traced these paths against the SQL rather than the tests:

- **Webhook inserts between `find()` and `record()`.** `record_merch_order` takes an advisory lock on the intent hash, re-selects by session id, and returns `created:false`. Cron skips. Correct.
- **Cron calls `block` before `record` on a missing refunded order.** `block_merch_payment` upserts `merch_payment_blocks` under the same intent lock; `record_merch_order` reads that table at `:250` and inserts as `on_hold`. Correct, and covered at `tests/merch.test.ts:301-311`.
- **Staff released a partial refund.** Stored and Stripe severities are equal, so `severity.indexOf(status) > severity.indexOf(existing.payment_status)` is false and no re-hold happens. A later full refund escalates. Correct.
- **Shipped order refunded later.** `block_merch_payment:318` keeps `shipped`. Correct.
- **Two cron runs overlapping, or script `--apply` during cron.** Both `record` calls serialize on the lock; only one gets `created:true`. Correct.
- **`annotate` fails after `record` succeeded.** Session lands in `failures`, cron 503s and alerts, order exists without the note; next run sees it as existing and never annotates. Harmless, but the order loses its "verify Pirate Ship" flag. P3.
- **Annotate only targets `fulfillment_status = 'new'`.** Recovered orders that land `on_hold` get no note. They already require review, so acceptable.

## New issues

No P1 or P2 found. Two P3 observations:

- **Alert fingerprint hashes the full failure detail.** If a transient error message varies per run, each hour produces a new email. Stripe and Supabase error strings are stable in practice, so this is low risk.
- **`stripe.disputes.list` runs per disputed charge on every hourly pass.** Trivial at current volume.

## Verified clean

Webhook ordering (physical before the `processed_stripe_events` claim, 503 on failed write) at `route.ts:64-89`. `physicalIntent` still gates refund handling so digital refunds fall through to the old handler. Ops order route still requires Basic auth plus same-origin and passes status through to the SQL validator. Alert bodies contain session ids and error strings only, no customer data. Cron registered at `vercel.json:16-19`.

## Before merge

1. Confirm in Stripe that the production endpoint subscribes to `charge.refunded` and `charge.dispute.created`.
2. After deploy, trigger `/api/cron/merch-reconcile` once via `www.daisychainsd.com` and confirm `imported: 0`, `failures: []`, and unchanged notes on the four live orders.
3. Decide and document the won-dispute reset procedure from finding 3.
