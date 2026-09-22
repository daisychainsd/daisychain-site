# Daisy Chain Recordings website

The public website, music store, and internal Ops dashboard for Daisy Chain Recordings. Built with Next.js, Sanity, Supabase, Stripe, and Vercel.

- Website: [www.daisychainsd.com](https://www.daisychainsd.com)
- Team dashboard: [Ops](https://www.daisychainsd.com/ops)
- Physical orders and shipping: [Merch Ops](https://www.daisychainsd.com/ops/merch) — Ops password required
- Preview: [dev.daisychainsd.com](https://dev.daisychainsd.com)

## Physical website orders

Stripe records the payment; Supabase stores the physical order and its fulfillment state; Pirate Ship creates labels. The September 22 recovery restored four paid physical website orders, with shipping history left unverified for manual reconciliation. See [the incident and deployment checkpoint](ORDER-RECOVERY-2026-09-22.md) for the exact live status of PR #24.

The recovery implementation records physical orders independently of the storefront catalog flag, retries failed writes, and reconciles Stripe history hourly. Merch Ops opens on All, with Unshipped and Shipped filters, manual shipping controls, optional tracking, and CSV export. Check older orders against Pirate Ship before shipping. Downloading a CSV marks Exported, not Shipped. Neither a manual status change nor reconciliation emails customers.

Shopify still supplies the storefront catalog. `MERCH_BACKEND` is unset; the Supabase product/image import and opening inventory count remain unfinished. Product and inventory edits in Ops do not change the Shopify-backed storefront. Do not enable the flag or cancel Shopify as part of order recovery.

## Read next

| Document | Purpose |
|---|---|
| [OPERATIONS.md](OPERATIONS.md) | Runtime services, webhooks, cron, access and recovery commands |
| [MERCH-ROLLOUT.md](MERCH-ROLLOUT.md) | Shipping workflow and the separate catalog/inventory migration |
| [ORDER-RECOVERY-2026-09-22.md](ORDER-RECOVERY-2026-09-22.md) | Incident evidence, recovery verification and deployment status |
| [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md) | Engineering conventions, architecture and branch rules |
| [design-system](design-system/README.md) | Brand and UI source of truth |
| [daisychain-ops](https://github.com/daisychainsd/daisychain-ops) | Team SOPs and operations map; the dashboard code lives in this site repo |
| [System map](https://github.com/daisychainsd/daisychainsd) | How all Daisy Chain repositories fit together |

## Development and verification

```sh
npm ci
npm run dev
npm run test:merch
npx tsc --noEmit
npm run build -- --webpack
```

Obtain environment access from PD. Never commit credentials or customer recovery exports. Local and preview credentials can reach production services: use isolated fixtures for purchase tests, not live checkout. Browser-test setup is in [tests/MERCH-BROWSER.md](tests/MERCH-BROWSER.md).

Push site changes to `dev`, verify the preview, then use a PR into protected `main` for production. A code deployment is not proof that database migrations, imports, or scheduled jobs have been activated; record the live checks in the incident/rollout document.
