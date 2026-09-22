# Daisy Chain Site — Operations

## What this system does
Public website + storefront for Daisy Chain Recordings at **daisychainsd.com**
(dev preview: dev.daisychainsd.com). Self-hosted Bandcamp alternative:
CMS-driven releases/artists/events (Sanity, embedded at `/studio`), streaming
previews, digital downloads, $99 unlimited pass, physical merch, guest
checkout, auto release-day promotion, and newsletter/SMS capture.

## Where it runs
- Vercel (Next.js 16 App Router). Branch flow: work on `dev` → merge to `main` to go live.
- Data: Supabase (auth, purchases, physical orders, download tokens) · Sanity (content) · Shopify (current merch catalog)

## Integrations at a glance
| Service | Role | Failure impact |
|---|---|---|
| Stripe | All payments + fulfillment webhook | Nobody can buy anything (highest severity) |
| Supabase | Auth, digital purchases, physical orders/fulfillment, guest tokens, pass | Logins/downloads fail; physical orders cannot appear in Ops |
| Sanity | Releases/artists/events content | Site content frozen; release drops need manual flip |
| Shopify Storefront | Current merch catalog and checkout pricing | Shop/physical checkout unavailable; recorded Ops orders remain accessible |
| Beehiiv | Newsletter signups + auto-subscribe on purchase | Email capture stops (purchases unaffected) |
| Laylo | SMS list from account signup | SMS capture stops (soft-fails) |
| Resend | Download links, order confirmations, owner alerts | Guests don't get download emails — bad |
| ffmpeg | Download format conversion + MP3 previews | Non-WAV downloads fail |

## The critical route
`POST /api/webhooks/stripe` verifies Stripe signatures and processes payment events. Physical orders are saved in Supabase `merch_orders` before notifications, regardless of `MERCH_BACKEND`. Session-level SQL idempotency prevents duplicate orders and stock deductions; failures return 503 so Stripe retries. Physical handling runs before the older digital `processed_stripe_events` claim. It does not create Shopify draft orders.

Legacy/Shopify-era orders use Stripe's purchased line items and address, without decrementing Supabase inventory. Supabase checkout snapshots deduct inventory transactionally. Refunds/disputes hold unshipped physical orders; digital entitlement handling remains separate. A notification outage does not undo a saved physical order.

**September 22 deployment status and evidence:** [ORDER-RECOVERY-2026-09-22.md](ORDER-RECOVERY-2026-09-22.md). The schema and four-order backlog are verified live; the document records when the reviewed code becomes production.

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
6. Ops → Physical orders health checks order storage even with the Shopify catalog active. `/ops/merch` is the complete paginated physical fulfillment list; the main dashboard's recent-orders panel is only a payment summary.
7. Reconcile Stripe against Ops using the audit command below; missing records must not be dismissed because webhook deliveries returned 200.

## Env vars (Vercel; local via `vercel env pull`)
Sanity: `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`,
`SANITY_API_TOKEN`, `SANITY_WEBHOOK_SECRET` ·
Stripe: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET` ·
Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` ·
Shopify: `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`,
`NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `SHOPIFY_STORE_DOMAIN`,
`SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `SHOPIFY_APP_CLIENT_ID`,
`SHOPIFY_APP_CLIENT_SECRET` ·
Email/SMS: `BEEHIIV_API_KEY`, `LAYLO_API_KEY`, `RESEND_API_KEY`, `ALERT_EMAIL` ·
Misc: `CRON_SECRET`, `STUDIO_PASSWORD`.

The site can build without full configuration, but live payments and order storage require their keys. Missing `OPS_PASSWORD` fails closed; missing physical-order storage is an operational failure, not a completed order.

## Local setup for a new collaborator
```bash
git clone https://github.com/daisychainsd/daisychain-site.git
cd daisychain-site && npm install
vercel env pull .env.local    # or get values from PD
npm run dev                   # localhost:3000
npm run build                 # run before merging to main — catches TS errors
```
Work on `dev`, PR to `main`. Never merge to `main` without walking the
purchase flow end-to-end.

## Ops dashboard
- **URL**: https://www.daisychainsd.com/ops — HTTP basic auth (any username,
  password = `OPS_PASSWORD`). If `OPS_PASSWORD` is unset the route 404s (fail
  closed). Gate lives in `src/proxy.ts`, covering `/ops` and `/api/ops`.
- **Panels**: Health (dc-email-api, Stripe, Supabase, Sanity, Physical orders, Shopify/catalog —
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

## Recover or audit physical orders

```sh
# Read-only; a missing order or error produces a nonzero exit.
node --env-file=/path/to/production.env --import tsx scripts/merch-reconcile.ts
# Import missing orders; check refunds/disputes; preserve manual shipping state.
node --env-file=/path/to/production.env --import tsx scripts/merch-reconcile.ts --apply
```

The September 14 merch schema and September 22 optional-tracking migration are already applied in production. Do not rerun the create-table migration or the full `supabase-schema.sql`. The product-image storage migration, catalog import and opening counts are separate remaining work.

The optional `--output=/private/path` writes recovery JSON and a Pirate Ship CSV with customer addresses. Keep them outside Git and reconcile shipping/payment status before using them. Recovery CSV references differ from final Ops order numbers. These commands cover physical **website Stripe Checkout** orders, not independent historical Shopify/Bandcamp/booth sales.

For daily shipping use [MERCH-ROLLOUT.md](MERCH-ROLLOUT.md) and the [team fulfillment SOP](https://github.com/daisychainsd/daisychain-ops/blob/main/SOP-merch-fulfillment.md).
