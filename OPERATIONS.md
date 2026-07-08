# Daisy Chain Site — Operations

## What this system does
Public website + storefront for Daisy Chain Recordings at **daisychainsd.com**
(dev preview: dev.daisychainsd.com). Self-hosted Bandcamp alternative:
CMS-driven releases/artists/events (Sanity, embedded at `/studio`), streaming
previews, digital downloads, $99 unlimited pass, physical merch, guest
checkout, auto release-day promotion, and newsletter/SMS capture.

## Where it runs
- Vercel (Next.js 16 App Router). Branch flow: work on `dev` → merge to `main` to go live.
- Data: Supabase (auth, purchases, download tokens) · Sanity (content) · Shopify (merch)

## Integrations at a glance
| Service | Role | Failure impact |
|---|---|---|
| Stripe | All payments + fulfillment webhook | Nobody can buy anything (highest severity) |
| Supabase | Auth, purchases, guest tokens, pass | Logins/downloads break |
| Sanity | Releases/artists/events content | Site content frozen; release drops need manual flip |
| Shopify Storefront + Admin | Merch catalog / draft orders for fulfillment | Shop empty / orders not created for Pirate Ship |
| Beehiiv | Newsletter signups + auto-subscribe on purchase | Email capture stops (purchases unaffected) |
| Laylo | SMS list from account signup | SMS capture stops (soft-fails) |
| Resend | Download links, order confirmations, owner alerts | Guests don't get download emails — bad |
| ffmpeg | Download format conversion + MP3 previews | Non-WAV downloads fail |

## The critical route
`POST /api/webhooks/stripe` is the fulfillment engine. On payment: records the
purchase (Supabase), creates the Shopify draft order (physical), emails the
download link/confirmation (Resend), subscribes the buyer to Beehiiv.
Idempotent via `processed_stripe_events`. Handles refunds/disputes by revoking
access. If it fails, buyers are charged and get nothing — an `[ALERT]` email
goes to playerdave@daisychainsd.com.

## Cron & webhooks
- `GET /api/cron/release-day` — hourly (Vercel cron, Bearer `CRON_SECRET`).
  Flips due releases `upcoming`→`live`, updates homepage, revalidates.
  Must target the `www.` domain — the bare-domain redirect strips the auth header.
- Stripe webhook (signature-verified). Needs `checkout.session.completed`,
  `charge.refunded`, `charge.dispute.created` subscribed.
- Sanity preview-gen webhook (HMAC) — written but not yet wired in Sanity dashboard.

## How to verify it's healthy
1. Site loads at daisychainsd.com, latest release on homepage.
2. Test purchase flow end-to-end before merging to `main` (house rule).
3. Stripe dashboard → webhook deliveries all 200.
4. Vercel → Logs for cron runs (hourly release-day).
5. `[ALERT]` emails to playerdave@daisychainsd.com mean a purchase record
   failed — act immediately (buyer paid, got nothing).
6. Ops dashboard at `/ops` (planned) will surface all of the above.

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

All integrations degrade gracefully when a key is missing — the site boots
without a full env.

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

## One-off scripts
`scripts/fix-rls-guest-tables.sql` — applied 2026-07-03 in Supabase SQL editor;
dropped permissive RLS policies that let the anon key read guest purchase data.
Kept for provenance.
