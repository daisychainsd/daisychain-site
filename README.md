# Daisy Chain Recordings website

The public website, music store, and internal Ops dashboard for Daisy Chain Recordings. Built with Next.js, Sanity, Supabase, Stripe, and Vercel.

- Website: [www.daisychainsd.com](https://www.daisychainsd.com)
- Team dashboard: [Ops](https://www.daisychainsd.com/ops)
- Products, inventory and shipping: [Merch Ops](https://www.daisychainsd.com/ops/merch) — Ops password required
- Preview: [dev.daisychainsd.com](https://dev.daisychainsd.com)

## Physical orders: website and Bandcamp

Stripe records the payment; Supabase stores the physical order and its fulfillment state; Pirate Ship creates labels. The September 22 recovery restored four paid physical website orders, with shipping history left unverified for manual reconciliation. See [the incident and deployment checkpoint](ORDER-RECOVERY-2026-09-22.md) for the exact live status of PR #24.

The recovery implementation records physical orders independently of the storefront catalog flag, retries failed writes, and reconciles Stripe history hourly. Merch Ops opens on Unshipped. Shipped and All orders are history views; the Source menu filters Website/Bandcamp, and Filters holds advanced statuses/test records. Select orders to reveal CSV actions. [UI behavior and validation](MERCH-UI-2026-09-22.md). Manual shipping controls, tracking and notes stay on each order. Check older orders against Pirate Ship before shipping. Downloading a CSV marks Exported, not Shipped. Neither a manual status change nor reconciliation emails customers.

**Verified September 22:** eight physical Bandcamp orders were imported alongside the four recovered website orders. All eight retained Bandcamp’s recorded shipped status; replay produced no duplicates or review holds.

Bandcamp physical orders use a separate merchandise-only feed through `dc-email-api`, reconciled hourly into the same queue. Use Source → Bandcamp to find them; digital song/album sales are excluded. Bandcamp shipping status is copied on first import; later syncs preserve manual Ops fulfillment, tracking and notes. Shipping recorded later in Bandcamp updates orders whose fulfillment has not been manually changed in Ops. See [Bandcamp setup and live verification](BANDCAMP-ORDERS-2026-09-22.md).

## Products and inventory — live September 29, 2026

Ops now manages the live shop catalog, product photos, prices, sizes and stock. Production and the dev preview use `MERCH_BACKEND=supabase`. The catalog contains 14 products and 38 variants with DCM01–DCM38 SKUs. The 384 units entered at launch are an opening count, not a permanent inventory target. Shopify remains available for legacy references and rollback; its cancellation is separate work.

Open Inventory or Products, click a product thumbnail, then enter stock changes by size. These fields **add or remove units**: enter `-2` for two units sold at a booth or `5` for five restocked units. Choose **Edit product & sizes** to change sizes, prices or photos. Under **Thumbnail framing**, enable **Crop to fill square**, adjust zoom and horizontal/vertical position, then save the product. The saved crop applies to cards and the large product-detail image. Original uploaded files stay intact; images without framing use the full-photo view.

[DC staple tee](https://www.daisychainsd.com/shop/dc-staple-tee) is live at $45 with S–XXL sizes and the replacement photo. Holy Cobra and Faded Black Daisy Tee are $27 (40% off $45); Brown DC Hoodie is $39 (40% off $65). See the [release and opening-stock record](MERCH-PRODUCT-EDITOR-2026-09-29.md) and [daily product workflow](MERCH-ROLLOUT.md#products-sizes-and-stock).

## Discounts and product placement

Ops owns product details, photos, stock, regular prices and discounts. Sanity owns independent Homepage and Shop selections and ordering using stable Ops product IDs; it does not copy the product catalog or require a sync cron. See [MERCH-DISCOUNTS-AND-PLACEMENT-2026-09-30.md](MERCH-DISCOUNTS-AND-PLACEMENT-2026-09-30.md) for release verification and [MERCH-ROLLOUT.md](MERCH-ROLLOUT.md) for daily editing.

In **Ops → Edit product & sizes**, enter regular prices, turn on **Offer a discount**, enter a whole percentage (1–99), check the preview, and save. Turn it off and save to restore regular prices. Customers see the original price struck through, the current price, and a red percentage badge. The three opening offers remain $45 → $27 for both tees and $65 → $39 for the hoodie.

In **Studio → Homepage → Homepage shop products** or **Studio → Shop → Shop products**, arrange the product list first, then enable **Choose products and their order**. Drag to reorder. Homepage edits are live; Shop edits require Publish. Automatic mode keeps the existing default; an empty manual list hides the product section. Changes reach cached pages on their next revalidation (60 seconds). Removing a placement does not unpublish the product: use Ops for that.

## Read next

| Document | Purpose |
|---|---|
| [OPERATIONS.md](OPERATIONS.md) | Runtime services, webhooks, cron, access and recovery commands |
| [MERCH-ROLLOUT.md](MERCH-ROLLOUT.md) | Current shipping, product editing, stock and thumbnail workflow |
| [MERCH-PRODUCT-EDITOR-2026-09-29.md](MERCH-PRODUCT-EDITOR-2026-09-29.md) | Verified live release, opening counts, prices and catalog cutover |
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
npm run test:merch-ui
npx tsc --noEmit
npm run build
```

`npm run build` uses webpack after the September 29 Vercel Turbopack font-compilation failure. Obtain environment access from PD. Never commit credentials or customer recovery exports. Local and preview credentials can reach production services: use isolated fixtures for purchase tests, not live checkout. Browser-test setup is in [tests/MERCH-BROWSER.md](tests/MERCH-BROWSER.md).

Requested changes publish to `main` after appropriate local checks and review. PD explicitly set this standing default on September 30, 2026; use `dev` only when PD asks to test there first. Do not ask again for routine go-live authorization already covered by the requested work. Handle GitHub operations directly: an ordinary fast-forward push or admin PR merge is authorized with the existing owner credentials. Preserve branch protections and never force-push. A code deployment is not proof that database migrations, imports, or scheduled jobs have been activated; record the live checks in the incident/rollout document.
