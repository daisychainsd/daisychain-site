# Merch replacement: independent Claude review

Date: 2026-09-14
Baseline: `2335f33` (`main`); local branch: `feature/merch-ops`.

The owner requested an adversarial Claude review before further implementation. This report was produced by the installed Claude Code CLI with only Read, Glob and Grep tools enabled and MCP tools disabled. It is a static review, not evidence of successful payment, database or shipping integration tests.

## State at the review checkpoint

- All 780 lines of `CLAUDE.md` have now been read by the implementing agent, including the August audit history and shared-production environment warning. Earlier implementation was based on relevant sections and the design instructions, not the full historical document.
- Four new, disconnected draft files exist: `src/lib/merch/types.ts`, `catalog.ts`, `csv.ts`, and `supabase/migrations/202609140001_merch.sql`.
- No existing application files were changed. No migration was applied. No live or test payment was created. No external application data was changed. Nothing was committed, pushed or deployed.
- Implementation is paused at the owner's requested review checkpoint. These drafts are not ready to activate.

## Implementing agent's assessment of the report

Accepted findings:

1. Physical paid-order persistence must be outside the existing claim-before-processing path. A failed durable write must remain retryable; repeated events and multiple events for the same session must not duplicate the order or stock movement.
2. The physical checkout currently submits digital cart items too. Filter physical items, preserve digital cart items after a physical purchase, and merge duplicate variant IDs before quantity/stock validation.
3. Catalog migration must preserve handles, variant identities, product content and images. Replace the Shopify health check as part of cutover. Read new tables only after schema and data are ready.
4. The four draft files do not establish a stock reservation policy. Negative-stock/on-hold handling is a proposed behavior, not a tested or accepted business rule. Manual booth tracking was explicitly requested; avoid turning v1 into a native POS project.
5. Validate/default all order payload fields before the database write; return enough information to distinguish an on-hold order from a normal order. Reconcile refunds and disputes without losing history or silently restocking shipped merchandise.
6. Put forms on a separate `/ops/merch` page: the main Ops page auto-refreshes every two minutes. Authenticate mutation/export endpoints directly as well as through the existing proxy, and reject cross-origin mutation requests.
7. Keep new-order export distinct from an intentional re-export; exporting is not shipping. Tracking notifications need a real implementation or accurate customer-facing copy.

Corrections and qualifications:

- **Catalog location is not blocked on permission.** The owner explicitly proposed storing this workflow in Supabase and managing it through Ops. `CLAUDE.md` says Sanity is *only* for frontend content, but does not require every product catalog to be in Sanity; the existing catalog is in Shopify. Sanity content plus Supabase stock is an option, not a mandatory standard. No new approval is inferred from this finding.
- **Do not follow the report's suggestion to test purchases on shared dev services.** `CLAUDE.md:629` and `AUDIT-PLAN-2026-08-06.md:9` require treating shared services as production. Test database changes and purchase side effects in an isolated local/test setup with mail/newsletter delivery disabled. A test-mode Stripe key alone is insufficient isolation.
- **Image lifetime was overstated.** The reviewer did not verify that Shopify images disappear immediately on cancellation. Owning/copying the assets before cancellation is still the correct migration requirement; do not rely on unverified CDN retention.
- **Missing payload fields are an integration risk, not a reproduced Stripe failure.** No caller of the drafted SQL function exists yet. An explicit server mapper can provide defaults and convert Stripe timestamps. Test the eventual mapper and transaction together.
- **Keeping an immutable checkout snapshot and durable payment blocks can be justified.** Neither is automatically scope creep: a catalog can change between checkout and payment, and refunds can race order writes. Retrieving Stripe state once does not by itself solve all event-ordering races. Choose the smallest design that demonstrably handles those cases.
- **Package weights need not be added to every product in v1.** Pirate Ship supports a common package preset/default, with per-row dimensions/weights overriding it. One CSV row per shipment and separate address columns match its documented import format. Customs information for international labels is a separate workflow consideration.
- **Do not assert order history instantly vanishes on cancellation.** Export and reconcile history before cancellation; retention behavior was not verified by this review.
- An arbitrary HTTP Basic username is not verified staff identity. Recording it would be a label, not a trustworthy actor audit trail.

## Evidence actually collected locally

- `./node_modules/.bin/tsc --noEmit --incremental false` passed. This checks TypeScript only; SQL and business behavior remain untested.
- A temporary local harness transpiled and exercised the real CSV draft with synthetic data. It confirmed that `canExport` excludes test/refunded orders, but an E.164 phone beginning with `+` gains a literal apostrophe in the encoded CSV. This needs correction and an import fixture before shipping.
- The same harness confirmed that `canExport` allows already-exported orders and that the low-level encoder accepts any supplied rows. The eventual export endpoint must enforce eligibility and distinguish new export from re-export; neither endpoint exists yet.

## Revised implementation sequence

1. Record the existing customer-facing behavior, shipping policy and catalog source data. Keep the current US/international policy unchanged until the pending shipping question is answered. Prepare a small spec for paid orders, fulfillment statuses, CSV fields and manual inventory adjustments.
2. Build and test the order persistence transaction and webhook path in isolation, including paid/unpaid, duplicate/concurrent delivery, failed-write retry, refund/dispute ordering and test/live separation. Preserve unrelated digital-purchase behavior.
3. Add `/ops/merch` with orders, explicit export/re-export, fulfillment/tracking and manual item adjustments. Match the design system and protect every customer-data read and mutation. Verify CSV fixtures against Pirate Ship's column mapping.
4. Import catalog content and copy images to owned storage, preserve handles/IDs, obtain a physical opening count, then switch catalog and server-side checkout pricing together. Test mixed carts, duplicate lines, unavailable variants, price tampering and the explicitly chosen stock-shortage behavior. Update health checks and project documentation.
5. Re-run independent review on the complete change, run the required build, and prepare a concrete preview/cutover plan. Live migrations, a live purchase test, production deployment and Shopify cancellation have not been performed or requested by the owner in this session.

## Claude's original report (verbatim)

I've read the draft files, both checkout routes, the Stripe webhook, both Shopify libs, the shop pages, the cart, the Ops page and health lib, the Supabase schema and RLS fix, the CSP config, and the design-system docs. Report follows.

# Adversarial review: Shopify removal / merch ops

## 1. Standards and architectural constraints

**P1. Catalog storage location is an unmade architectural decision.** `src/lib/merch/catalog.ts:5` puts product content in Supabase read through the service-role client. CLAUDE.md says Sanity is the home of frontend website content, and Sanity already gives the team a Studio with image upload, CDN delivery, `hidden`, liveEdit, and existing accounts for Niko. A Supabase catalog means either a second admin UI you have to build for products and images, or Niko editing rows in the SQL editor. Recommendation: `merchProduct` documents in Sanity for title, handle, description, images, options and per-variant price and stable variant key. Supabase holds only the mutable counter and the orders. Price resolution then follows the existing pattern in `src/app/api/checkout/route.ts:65-74`. If you keep Supabase for content, that is a decision the user has to make, not a default.

**P0. Image hosting must be settled before Shopify is cancelled.** `MerchImage.url` in `src/lib/merch/types.ts:2` is an opaque URL. If the import copies `cdn.shopify.com` URLs, every catalog image dies the day the store closes. Sanity assets are already allowed by CSP at `next.config.ts:24`. Supabase Storage is not, and would need an `img-src` change. The `shopifyImg` resize helpers at `src/app/shop/page.tsx:9` and `src/components/ShopStrip.tsx:15` also only work on Shopify hosts.

**P1. The existing Shopify health check becomes a daily false alarm.** `src/lib/ops-health.ts:205-210` pings the store. Once cancelled it fails forever, the Ops header goes red, and the daily cron emails ALERT_EMAIL every morning. It must be replaced with a merch-DB check in the same PR as cutover.

**P1. Migration convention conflict.** The repo runs SQL by hand from `supabase-schema.sql` and `scripts/*.sql`, per CLAUDE.md Session 11. `supabase/migrations/202609140001_merch.sql` introduces a CLI-style folder with no `config.toml`, and the timestamp has 12 digits, not the 14 the Supabase CLI expects. Pick one convention and fold the schema into `supabase-schema.sql` as the audit did with the RLS fix.

**P1. Shared production database changes the cutover order.** CLAUDE.md is explicit that dev shares Supabase with production. `catalog.ts:9` throws when the table is missing, and `src/app/shop/page.tsx:146` does not catch, so deploying catalog-reading code before the migration 500s `/shop` on dev and, if merged, on prod. `generateStaticParams` at `src/app/shop/[handle]/page.tsx:17-20` runs the same query at build time, so the build itself fails. Same lesson as the Sanity aclMode flip: migrate first, deploy second.

**P2. Ops UI constraints that the merch panel must respect.**
- All mutation endpoints must live under `/api/ops/*` or be server actions on `/ops*` pages, because that is the only surface `src/proxy.ts:12` and the matcher at line 104 protect.
- `src/app/ops/page.tsx:324` reloads the page every two minutes. A tracking-number or inventory-adjustment form on that page gets wiped mid-entry. Put merch on `/ops/merch` without the meta refresh.
- The basic-auth gate accepts any username at `proxy.ts:22`. `merch_inventory_adjustments` has `reason` but no actor column. Capture the supplied username so a Niko booth adjustment is distinguishable from a Charlie correction.
- Follow the existing `Panel` and `StatRow` primitives, heading font uppercase, mono for numbers, no emoji, `container-pill-r` for the export button.

**P2. Unrequested tables and dead dependencies.** `merch_checkouts` at `202609140001_merch.sql:31-35` is referenced by nothing and duplicates what Stripe line items already snapshot. `merch_payment_blocks` at lines 78-81 can be replaced by one `paymentIntents.retrieve` with `latest_charge` expanded at record time. `@shopify/hydrogen-react` in `package.json:15` is imported nowhere and should go with the rest of Shopify.

**P2. Branch target.** CLAUDE.md says feature branches PR into `dev`, never `main`. `feature/merch-ops` is based on main, which is fine, but the PR must target `dev`.

## 2. Correctness and scope

### Already broken in the existing code

**P0. Webhook claims the event before doing the work, and returning 5xx will not help.** `src/app/api/webhooks/stripe/route.ts:66-81` inserts the event id first, then the handler at lines 86-129 swallows every exception. If you change the physical path to return 500 on a failed order write, the Stripe retry hits line 71-74 and is skipped as a duplicate. "Process before claim" is therefore mandatory for the physical path, or the claim row must be deleted on failure. Do not reorder the digital handlers; a retry there re-sends download emails.

**P1. Mixed carts cannot check out physical at all.** `src/app/shop/checkout/page.tsx:27-30` sends every cart item, including digital ones with ids like `digital-release-<slug>`. `src/app/api/checkout-physical/route.ts:41` rejects anything not prefixed `gid://shopify/ProductVariant/`, so a cart holding one track and one vinyl gets a 400 on the physical button. `src/app/shop/checkout/success/page.tsx:11` then clears digital items too after a physical purchase. One-line fix: filter `type !== "digital"` before posting. This will still be broken after the Supabase switch, just with a different error.

**P1. Shipping copy already contradicts the checkout.** `src/app/shop/page.tsx:161` advertises free US shipping over fifty dollars. `checkout-physical/route.ts:109-143` always charges and shows all three rates to every country, so a Japanese buyer sees "Standard" and a US buyer sees "International". The user said shipping scope is unanswered. Surface this as a decision; do not fix it silently.

**P2. Physical metadata overflows Stripe's limit on large carts.** `checkout-physical/route.ts:144-147` stores a JSON array of `{vid, qty}` in one metadata key. Preserved Shopify ids are about 60 characters per line; the cap is 500, so roughly nine distinct variants fail session creation. The digital route already chunks at `checkout/route.ts:231-251`.

**P2. Refund alert copy is wrong for merch.** `route.ts:231-237` emails "ACCESS REVOKED" for any refund. A refunded vinyl needs a different message and a restock decision.

**P2. Stripe event subscriptions are unverifiable from code.** The comment at `route.ts:139-141` says `charge.refunded` and `charge.dispute.created` must be enabled on the endpoint. Confirm in the dashboard before relying on `block_merch_payment`.

### Defects in the draft files

**P1. `record_merch_order` violates NOT NULL on any absent payload key.** `202609140001_merch.sql:111-119` inserts `payload->>'email'`, `customer_name`, `phone`, `currency`, `created_at` directly. A missing key yields SQL NULL, and column defaults do not apply to an explicit NULL, so the insert fails. Stripe gives no name when the buyer only fills shipping, and `session.created` is a unix integer, not a timestamptz. Wrap each in `coalesce`.

**P1. The function hides the on-hold outcome from the caller.** Line 141 returns only `id` and `created`. The webhook cannot know the order went to `inventory_issue` without a second select, so no alert fires and the buyer still gets the "we're packing your order" email from `src/lib/email.ts:165`. Return `inventory_issue` in the result.

**P1. Negative stock is a business decision the user has not made.** Lines 126-137 let a paid order push stock below zero. The alternative that needs no reservations: check `stock >= quantity` when creating the Checkout Session, and accept that two buyers who both start checkout on the last unit within the same few minutes produce one on-hold order. For this label's volume that is the right v1, but it must be stated to the user, along with the refund SOP for the loser. Full reservations with `checkout.session.expired` cleanup are not worth it yet.

**P1. Duplicate variant lines defeat a numeric stock check.** `checkout-physical/route.ts:36-49` accepts two lines for the same variant. With Shopify's boolean that was harmless. With per-line `stock >= qty` it lets a buyer purchase twenty units of a ten-unit item. Merge by variant id before checking.

**P1. Partial refunds never reach the merch path.** `route.ts:157-165` returns early on partial refunds, so `block_merch_payment` with `partially_refunded` at lines 165-179 is dead code unless the handler is modified. When it is wired, note the function forces `on_hold` on partial refunds, which blocks a legitimate "refund shipping overcharge, still ship" case with no un-hold path in the types.

**P2. Refunds do not restock.** Nothing writes a positive adjustment when an order is refunded before shipping. Either the SOP says "adjust manually" or the webhook writes the reversal. Decide.

**P2. Test orders consume real order numbers.** `order_number` is an identity at line 39. Test rows with `livemode=false` from dev take numbers, so DC-00001 may be a Stripe test. The `livemode` gate in `record_merch_order` line 122 and `canExport` in `csv.ts:26` are correct, but the dashboard must filter or badge test rows because dev and prod share the table.

**P2. CSV details.**
- Phone is always empty because `checkout-physical` never enables `phone_number_collection`. International Pirate Ship labels often need it. Enabling it is a checkout behavior change; flag it.
- No weight per row means Pirate Ship prompts for every order on import. A `weight_oz` on the product would avoid a second migration later.
- The formula guard at `csv.ts:6` prefixes an apostrophe that survives onto the printed label for any name starting with a hyphen. Tolerable, but know it.
- Export must be a POST with `Content-Disposition: attachment`, or a link prefetch marks orders `exported`.

**P2. Description rendering.** `catalog.ts:19` sets `descriptionHtml` to an empty string and `ProductDetail.tsx:163-166` renders plain text, so there is no injection risk. The import must copy Shopify's plain `description`, not `descriptionHtml`, or tags print literally. Multi-paragraph text already collapses; `whitespace-pre-line` fixes that.

**P2. Item snapshot source.** Build `items` from `listLineItems` for title and price and from `metadata.variants` for ids, as `route.ts:294` already does for names. Looking variants up at webhook time snapshots whatever the catalog says minutes later.

**P2. `adjust_merch_inventory` replay ignores the variant.** Lines 153-156 return the stock of whatever variant is passed, not the one originally adjusted. Cosmetic.

### Risks in the planned work

**P1. Initial stock has no source.** The Shopify app scope is `write_draft_orders` only, so Admin inventory is unreadable, and the Storefront `quantityAvailable` field needs a scope the token may not have. Plan for a physical count entered by Niko at cutover.

**P2. Export Shopify order history before cancelling.** Draft orders D3 and D4 and any customer records vanish with the store.

**P2. The confirmation email promises tracking.** `email.ts:165` says a shipping notification will follow. None exists, and the draft stores `tracking_number` but sends nothing. Either build "mark shipped sends tracking" or change the copy.

**P2. Tap to Pay sales never hit the webhook.** They are PaymentIntents without a Checkout Session, so the manual adjustment path is the only inventory signal. That matches the request; make sure the SOP says so.

## Verdict and sequence

**Not ready to implement as drafted.** Two decisions block it: where catalog content lives, and the oversell policy. Three ordering constraints are P0 or P1: migrate before deploying reading code, re-host images before cancelling Shopify, and process before claiming in the webhook. The SQL also fails on real Stripe payloads until the NULL handling is fixed.

Smallest sensible sequence:

1. **Decide** catalog location (recommend Sanity content plus Supabase stock), oversell policy (recommend stock check at checkout, on-hold on race, no reservations), and whether shipping copy stays untouched.
2. **PR 1, no buyer-visible change.** Orders and adjustments tables plus a fixed `record_merch_order` run by hand in the SQL editor. Webhook dual-writes the merch order before the event claim and returns 500 only on RPC failure, keeping the Shopify draft order for now. `/ops/merch` page with orders, POST CSV export, mark shipped with tracking, and adjustment form. Fix the mixed-cart filter. Verify with test-mode orders on dev, which land as `livemode=false`.
3. **PR 2, cutover.** Import products and images to the chosen store preserving handles and variant ids, switch `getProducts`, `getProductByHandle` and `/api/shopify-product` to it, price and stock-check from it in `checkout-physical` with merged lines, swap the Shopify health check, and drop draft-order creation. Run one real order end to end.
4. **Cancel Shopify** only after step 3 has handled a live order. Export order history first, then delete `shopify-admin.ts`, the env vars, the CSP entries, and `@shopify/hydrogen-react`.
