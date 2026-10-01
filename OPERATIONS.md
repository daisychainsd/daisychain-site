# Daisy Chain Site — Operations

## Discounts and CMS placement — September 30, 2026

Ops owns product details, photos, stock, regular prices and discounts. Sanity owns independent Homepage and Shop selections and ordering using stable Ops product IDs; it does not copy the product catalog or require a sync cron. See [MERCH-DISCOUNTS-AND-PLACEMENT-2026-09-30.md](MERCH-DISCOUNTS-AND-PLACEMENT-2026-09-30.md) for release verification and [MERCH-ROLLOUT.md](MERCH-ROLLOUT.md) for daily editing.

The release adds `merch_products.discount_percent` and `merch_variants.compare_at_price_cents`; `price_cents` remains the effective checkout price. `save_merch_product` calculates prices atomically from explicit `regular_price_cents`. Old clients without that field must reload. The additive `scripts/merch-discounts-2026-09-30.sql` is applied; do not rerun the old full schema/import/opening-stock scripts. Migration reruns never reactivate disabled offers.

Homepage selection is `homepageSettings.merch`; Shop is the `shopSettings` singleton's `merch`. Both store ordered `productId` entries and a manual-selection switch. The picker offers only products with an available size; saved sold-out selections stay labeled for replacement or removal and become selectable again after restocking. Empty manual lists hide that section. Homepage is live-edit; Shop requires Publish. `/api/merch-products` contains public storefront fields only, cached briefly for Studio. Ops publication remains authoritative for direct product URLs. A Sanity failure falls back to the published Ops catalog on Shop. No new cron or credentials are required.

Validation: 53 merch tests, nine editor/CMS/storefront DOM tests, isolated desktop/mobile Chromium, TypeScript, production webpack build and Sanity schema extraction. Actual Claude adversarial review: SHIP after fixing the stale-client double-discount bug. Product pages initially select an available size. See the release record for exact deployment and read-only live verification.

## What this system does
Public website + storefront for Daisy Chain Recordings at **daisychainsd.com**
(dev preview: dev.daisychainsd.com). Self-hosted Bandcamp alternative:
CMS-driven releases/artists/events (Sanity, embedded at `/studio`), streaming
previews, digital downloads, $99 unlimited pass, physical merch, guest
checkout, auto release-day promotion, and newsletter/SMS capture.

## Where it runs
- Vercel (Next.js 16 App Router). Publish requested changes to `main` after checks; use `dev` only when explicitly requested.
- Data: Supabase (auth, purchases, physical orders, merch catalog/images/inventory, download tokens) · Sanity (content) · Shopify (legacy catalog fallback)

## Integrations at a glance
| Service | Role | Failure impact |
|---|---|---|
| Stripe | All payments + fulfillment webhook | Nobody can buy anything (highest severity) |
| Supabase | Auth, digital purchases, merch catalog/images/stock, physical orders/fulfillment, guest tokens, pass | Logins/downloads, shop and physical checkout fail; physical orders cannot appear in Ops |
| Sanity | Releases/artists/events content | Site content frozen; release drops need manual flip |
| Shopify Storefront | Legacy catalog fallback; not the active storefront backend | Affects fallback/import tools; the active Supabase shop remains independent |
| Beehiiv | Newsletter signups + auto-subscribe on purchase | Email capture stops (purchases unaffected) |
| Laylo | SMS list from account signup | SMS capture stops (soft-fails) |
| Resend | Download links, order confirmations, owner alerts | Guests don't get download emails — bad |
| ffmpeg | Download format conversion + MP3 previews | Non-WAV downloads fail |

## The critical route
`POST /api/webhooks/stripe` verifies Stripe signatures and processes payment events. Physical orders are saved in Supabase `merch_orders` before notifications, regardless of `MERCH_BACKEND`. Session-level SQL idempotency prevents duplicate orders and stock deductions; failures return 503 so Stripe retries. Physical handling runs before the older digital `processed_stripe_events` claim. It does not create Shopify draft orders.

Legacy/Shopify-era orders use Stripe's purchased line items and address, without decrementing Supabase inventory. Supabase checkout snapshots deduct inventory transactionally. Refunds/disputes hold unshipped physical orders; digital entitlement handling remains separate. A notification outage does not undo a saved physical order.

**September 22 deployment status and evidence:** [ORDER-RECOVERY-2026-09-22.md](ORDER-RECOVERY-2026-09-22.md). The schema, four-order backlog, reviewed code and first scheduled reconciliation are verified live after PR #24.

**September 29 catalog activation:** [PR #28](https://github.com/daisychainsd/daisychain-site/pull/28) is live with `MERCH_BACKEND=supabase` in production and dev preview. Ops owns products, prices, images, sizes and stock. The release verified 14 products, 38 variants, DCM01–DCM38 and 384 opening units. See the [activation record](MERCH-PRODUCT-EDITOR-2026-09-29.md); counts can change with sales.

## Cron & webhooks
- `GET /api/cron/release-day` — hourly (Vercel cron, Bearer `CRON_SECRET`).
  Flips due releases `upcoming`→`live`, updates homepage, revalidates.
  Must target the `www.` domain — the bare-domain redirect strips the auth header.
- Stripe webhook (signature-verified). Needs `checkout.session.completed`,
  `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created` subscribed.
- `GET /api/cron/merch-reconcile` — hourly at minute 15 UTC (`15 * * * *`), protected by `CRON_SECRET`. Scans paginated completed Stripe sessions, imports missing paid physical orders, and checks refunds/disputes without resending customer confirmations. Failures return 503 and attempt an owner alert. Verify deployment and cron execution; absence of email alone does not prove it ran.
- Sanity preview-gen webhook (HMAC) — written but not yet wired in Sanity dashboard.

## How to verify it's healthy
1. Site loads at daisychainsd.com, latest release on homepage.
2. Verify checkout/webhook flow using isolated test fixtures before merging to `main`; preview shares production services.
3. Stripe dashboard → webhook deliveries all 200.
4. Vercel → Logs for cron runs (hourly release-day).
5. `[ALERT]` emails to playerdave@daisychainsd.com mean a purchase record
   failed — act immediately (buyer paid, got nothing).
6. Ops → Physical orders checks order storage independently of the catalog flag. The Merch health check verifies an active catalog and flags live held orders. `/ops/merch` is the complete paginated physical fulfillment list; the main dashboard's recent-orders panel is only a payment summary.
7. Reconcile Stripe against Ops using the audit command below; missing records must not be dismissed because webhook deliveries returned 200.

## Env vars (Vercel; local via `vercel env pull`)
Sanity: `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`,
`SANITY_API_TOKEN`, `SANITY_READ_TOKEN`, `SANITY_WEBHOOK_SECRET` ·
Stripe: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET` ·
Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` ·
Merch catalog: `MERCH_BACKEND=supabase` in production and dev preview ·
Shopify fallback: `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`,
`NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `SHOPIFY_STORE_DOMAIN`,
`SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `SHOPIFY_APP_CLIENT_ID`,
`SHOPIFY_APP_CLIENT_SECRET` ·
Email/SMS: `BEEHIIV_API_KEY`, `LAYLO_API_KEY`, `RESEND_API_KEY`, `ALERT_EMAIL` ·
Misc: `CRON_SECRET`, `STUDIO_PASSWORD`, `OPS_PASSWORD`.

The site can build without full configuration, but live payments and order storage require their keys. Missing `OPS_PASSWORD` fails closed; missing physical-order storage is an operational failure, not a completed order.

## Local setup for a new collaborator
```bash
git clone https://github.com/daisychainsd/daisychain-site.git
cd daisychain-site && npm install
vercel env pull .env.local    # or get values from PD
npm run dev                   # localhost:3000
npm run test:merch             # isolated SQL/webhook/route fixtures
npm run test:merch-ui          # isolated product-editor DOM checks
npm run build                 # webpack production build, including TypeScript
```
Requested changes publish to `main` after appropriate local checks and review. PD explicitly set this standing default on September 30, 2026; use `dev` only when PD asks to test there first. Do not ask again for routine go-live authorization already covered by the requested work. Handle GitHub operations directly: an ordinary fast-forward push or admin PR merge is authorized with the existing owner credentials. Preserve branch protections and never force-push. Verify purchase behavior with isolated fixtures; preview shares production Supabase and is not a disposable payment environment. The build command explicitly selects webpack after Vercel's September 29 Turbopack Google Font resolution failure.

## Ops dashboard
- **URL**: https://www.daisychainsd.com/ops — HTTP basic auth (any username,
  password = `OPS_PASSWORD`). If `OPS_PASSWORD` is unset the route 404s (fail
  closed). Gate lives in `src/proxy.ts`, covering `/ops` and `/api/ops`.
- **Panels**: Health (dc-email-api, Stripe, Supabase, Sanity, Physical orders, Merch —
  shared checks in `src/lib/ops-health.ts`), Orders (last 10 Stripe charges +
  30-day revenue), Email (dc-email-api `/api/status`: subscriber count, last
  post, sync cursors, Laylo webhook age), Upcoming (Sanity events with a
  future date + releases still marked `upcoming`). Page self-refreshes every
  2 minutes.
- **Alert cron**: `GET /api/cron/ops-health` — daily `0 14 * * *` UTC
  (Vercel cron, Bearer `CRON_SECRET`). Emails `ALERT_EMAIL` (default
  playerdave@daisychainsd.com) via Resend with subject `[OPS] N system(s)
  failing` when any check fails; silent when all green.
- **Env vars**: `OPS_PASSWORD` (required for the page to exist),
  `DC_EMAIL_API_INTERNAL_SECRET` (= dc-email-api's `INTERNAL_SECRET`),
  `DC_EMAIL_API_URL` (optional, defaults to https://dc-email-api.vercel.app).
  Everything else reuses existing keys (Stripe/Supabase/Sanity/Shopify/
  Resend/`CRON_SECRET`/`ALERT_EMAIL`).

## One-off scripts
`scripts/fix-rls-guest-tables.sql` — applied 2026-07-03 in Supabase SQL editor;
dropped permissive RLS policies that let the anon key read guest purchase data.
Kept for provenance.

**Sensitive environment exports:** Vercel exports sensitive variables such as `CRON_SECRET` as blank. Check Vercel configuration and scheduled execution before diagnosing a missing secret or rotating it.

## Recover or audit physical orders

```sh
# Read-only; a missing order or error produces a nonzero exit.
node --env-file=/path/to/production.env --import tsx scripts/merch-reconcile.ts
# Import missing orders; check refunds/disputes; preserve manual shipping state.
node --env-file=/path/to/production.env --import tsx scripts/merch-reconcile.ts --apply
```

The September 14 merch schema and September 22 optional-tracking/Bandcamp migrations are already applied in production. The public product-image bucket, catalog import and opening counts were completed September 29. Do not rerun the create-table migration, full `supabase-schema.sql`, full catalog import or opening-stock setup against production. Routine changes belong in Ops; preserve current counts and product edits.

The optional `--output=/private/path` writes recovery JSON and a Pirate Ship CSV with customer addresses. Keep them outside Git and reconcile shipping/payment status before using them. Recovery CSV references differ from final Ops order numbers. These commands cover physical **website Stripe Checkout** orders, not independent Shopify-native or booth sales. Bandcamp physical orders use the separate reconciliation below.

For daily shipping use [MERCH-ROLLOUT.md](MERCH-ROLLOUT.md) and the [team fulfillment SOP](https://github.com/daisychainsd/daisychain-ops/blob/main/SOP-merch-fulfillment.md).

## Won or closed physical disputes

Disputes are deliberately not auto-released to shipping. After Stripe shows `won` or `warning_closed`, PD/developer must verify the current charge and any refunds, match the payment-intent ID to the order, and reconcile **both** stored records in one database transaction:

- `merch_payment_blocks`: remove that intent's block if fully paid, or replace its status with the verified `partially_refunded` / `refunded` state.
- `merch_orders.payment_status`: set the same verified payment state (`paid` when there is no remaining refund/block). Keep an unshipped order on hold and add a note with the dispute ID, outcome and verification date; preserve an already-shipped order's actual shipping state.

Resetting only the order leaves the old disputed payment block behind and can recreate the dispute hold during a later refund. Run reconciliation again, verify the state remains correct, then explicitly release an eligible held order through Ops. Never clear an open/lost dispute or assume a won dispute means the parcel should ship.


## Bandcamp physical orders

The physical-only source is Bandcamp `merchorders/4/get_orders`, proxied through `dc-email-api` at `GET /api/internal/bandcamp-merch` using the existing `DC_EMAIL_API_INTERNAL_SECRET`. It reuses that service's Bandcamp OAuth cache; no Bandcamp credentials are copied into this site. Digital sales and the mailing-list cursor are not involved.

`GET /api/cron/bandcamp-orders` runs hourly at `25 * * * *`, protected by `CRON_SECRET`, independently of Stripe reconciliation. The feed reads all history including shipped/refunded orders; v4 reports failed payments correctly. One Ops order groups items by Bandcamp band ID + payment ID; unique source keys and a transactional RPC make replays idempotent. Item amounts use captured line totals, including uneven cent division across quantity. Currency support is currently USD; other currencies fail visibly for developer reconciliation.

```sh
node --env-file=/path/to/production.env --import tsx scripts/bandcamp-reconcile.ts
node --env-file=/path/to/production.env --import tsx scripts/bandcamp-reconcile.ts --apply
```

Read-only audit exits nonzero for missing orders/errors. `--apply` inserts missing records and refreshes payment/source metadata without changing manual shipping state, tracking, notes or inventory. Initial imports carry Bandcamp ship dates; later Bandcamp shipping changes update untouched orders, while explicit manual Ops status changes take priority; partial shipments or suspicious totals/addresses start On hold. Pending/failed/refunded orders cannot ship or export. A later refund holds an unshipped order; a shipped order retains its shipment history. Manual Ops shipping changes do not update Bandcamp or send customer email. If staff also mark shipped in Bandcamp, use its own interface and notification settings.

Changed purchased items, recipient/address or amounts set `source_data.review_needed`, block fulfillment and return a reconciliation failure while retaining the original snapshot and applying any refund status. Ops shows **Review updated Bandcamp details** with the incoming snapshot. PD compares it with the saved order and any existing Pirate Ship label, adds a review note and accepts the update. The RPC verifies that the reviewed snapshot is still current and replaces it atomically. Unshipped orders remain On hold until explicitly released. Never clear a payment block or discard an item merely to make export work. Cron failures alert PD and return 503; successful syncs send no email.

**Applied and production-verified September 22:** `scripts/merch-bandcamp-2026-09-22.sql`, including the eight-order import. No further setup is needed on the existing production database. For a different existing merch database, apply this migration before enabling Bandcamp reconciliation. It is rerunnable, adds explicit source columns, allows null Stripe IDs for Bandcamp, and preserves service-role-only access. Do not rerun the older create-table migration. [Bandcamp deployment record](BANDCAMP-ORDERS-2026-09-22.md) tracks actual activation and the initial eight-order import.
