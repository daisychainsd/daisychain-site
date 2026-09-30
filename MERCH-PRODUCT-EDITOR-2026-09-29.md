# Merch catalog and product editor — September 29, 2026

## Live release

The shop and Ops product editor are live through [PR #28](https://github.com/daisychainsd/daisychain-site/pull/28), merge `a4ded457956029c122616813a60f2024d074610d`. Vercel production deployment `dpl_etGeB97pezUvB44v3qnB8tLVtomU` completed at September 29, 10:46pm PT. PD explicitly authorized the repository-owner override for this release's one-review requirement; branch protection remains in place.

Production and the dev preview use `MERCH_BACKEND=supabase`. Ops is the source for product content, images, prices, sizes and stock. Shopify cancellation was not part of this release; its helpers and credentials remain for legacy references and rollback.

- [Live shop](https://www.daisychainsd.com/shop)
- [DC staple tee](https://www.daisychainsd.com/shop/dc-staple-tee)
- [Merch Ops](https://www.daisychainsd.com/ops/merch)
- [Daily product and shipping workflow](MERCH-ROLLOUT.md)

## Product editing

Inventory and Products open a clickable thumbnail grid. Each product opens its own size rows, current stock, signed quantity adjustments, projected totals and recent adjustment history. Edit product & sizes opens the product details, photos, visibility, size names, prices and SKUs. Card actions have a dedicated, bottom-aligned row with 20px separation.

Stock inputs **add or remove units**, not replace totals. Confirmed rows clear individually. Unknown responses retain the same request IDs and freeze navigation until Retry remaining changes resolves the outcome. A failed refresh after a confirmed save does not replay the adjustment.

Sizes can be added or renamed within the product editor. New variants inherit the product price and suggest the next DCM code. Each size/variant has its own SKU. The imported variants use DCM01–DCM33; staple S/M/L/XL/XXL use DCM34–DCM38 respectively.

## Thumbnail framing

Edit product & sizes → Thumbnail framing controls the first product photo. Enable Crop to fill square, adjust zoom (1–3×) and horizontal/vertical position (0–100%), then Save product. Reset to full photo removes the framing setting.

The optional `thumbnailCrop` metadata is stored on image JSON and validated by the product API. `src/lib/merch/thumbnail.ts` is shared by Ops, shop cards, the homepage shop strip and gallery thumbnails. Full product photos use contain. Original uploaded files remain unchanged; no database schema migration was required. This is separate from Sanity's flyer crop tool.

## Confirmed opening stock and prices

These are the September 29 opening counts supplied by PD, **not current stock targets**. Later sales and adjustments must not be reset to this snapshot. Unlisted products and sizes started at zero.

| Product | Opening quantities | Total | Unit price |
|---|---|---:|---:|
| DC staple tee | S 3, M 6, L 12, XL 8, XXL 3 | 32 | $45 |
| Disco tee | M 4, L 9, XL 4, 2XL 1 | 18 | $40 |
| Holy Cobra tee | S 4, M 4, L 4, 2XL 1 | 13 | $27 (40% off $45) |
| Brown DC Hoodie | S 5, M 4 | 9 | $39 (40% off $65) |
| Faded Black Daisy Tee (grey shirt) | S 3, M 4 | 7 | $27 (40% off $45) |
| Dream Disc CD | 65 | 65 | $20 |
| Mini Daisy Chain | 100 | 100 | $40 |
| Daisy Chain 2.0 | 100 | 100 | $50 |
| Black Daisy Beanie | 40 | 40 | $35 |
| **Total** | | **384** | |

Sale prices are stored as the actual catalog unit prices; this release does not add a separate compare-at price or discount badge. The staple tee uses the replacement 1400×1400 PNG from PD's STAPLE TEE folder and is published with all five variants active.

## Completed migration and recovery artifacts

The existing 13 Shopify products, 33 variants and 44 image references were imported with handles and variant IDs preserved. The public `merch-images` bucket is configured. The staple tee adds one product and five variants, for 14 products and 38 variants. All prices, stocks, unique SKUs and the replacement photo were independently verified before cutover.

The following are one-time release/recovery tools, not routine setup:

- `scripts/prepare-merch-catalog-update.mjs`: reviewed SKU/photo plan in `.merch-import/sku-photo-update.json`; application completed.
- `scripts/prepare-merch-opening-stock.mjs`: confirmed stock plan, optional transactional SQL and local CSV. Do not regenerate opening counts to replenish sold stock.
- `scripts/apply-merch-opening-stock.mjs`: applied the saved opening plan through existing RPCs with fixed request IDs. Retries use the same IDs and absolute sale prices. The generated SQL alternative shares those IDs; do not apply both unnecessarily.
- `.merch-import/` holds ignored local snapshots/plans. `/Users/pd/Downloads/Daisy-Chain-confirmed-stock.csv` is the historical count worksheet.
- `/Users/pd/Downloads/Daisy-Chain-product-editor-preview.html` is a simulated offline preview. Its saves never affect production; use the live dashboard for current stock.

Do not rerun the create-table schema, full production schema, full catalog import or opening-stock setup. Re-import can overwrite product content. Routine stock, price, size and image edits belong in Ops. New website checkout snapshots deduct inventory once when paid; Bandcamp, booth and legacy Shopify-era orders require manual stock reconciliation.

## Verification

- 47 merch tests passed, including actual SQL transactions, webhook/route handling and crop validation.
- 5 product-editor DOM tests passed: product navigation, multi-size saves, partial failures, unknown-response retries, failed-refresh behavior, size/SKU editing and crop persistence/reset.
- Both isolated Playwright desktop/mobile flows passed, including CSV/shipping behavior and retry request IDs.
- TypeScript and targeted lint passed with the repository's expected plain-image warnings.
- The generated opening SQL was verified in isolated PGlite: exact 384-unit plan, safe replay, no replenishment after a simulated sale, and rollback on unexpected starting stock.
- Local production webpack build and Vercel preview/production builds passed. Default Turbopack failed resolving its internal Google Font module on Vercel, so `npm run build` explicitly uses webpack.
- Read-only Chromium checks passed on dev and production: staple price and five sizes, all three reduced prices, all 14 product cards with fully decoded images, framing controls, no mobile overflow and no browser runtime errors. API mutations were blocked during those checks. No live payment, inventory change or shipment was created for testing.

Monitor the next genuine paid order through Stripe → Ops and its inventory deduction. The release verification did not create a paid production transaction or buy a Pirate Ship label. Temporary verification credential exports were removed.
