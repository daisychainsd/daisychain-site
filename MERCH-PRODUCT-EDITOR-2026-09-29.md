# Product inventory editor — September 29, 2026

## Live verification — September 29, 2026, 10:46pm PT

Released through [PR #28](https://github.com/daisychainsd/daisychain-site/pull/28), merge `a4ded457956029c122616813a60f2024d074610d`. PD explicitly authorized the owner override for GitHub's one-review requirement. Production deployment `dpl_etGeB97pezUvB44v3qnB8tLVtomU` is Ready. Both production and dev preview use `MERCH_BACKEND=supabase`.

Verified https://www.daisychainsd.com in Chromium: staple tee's five sizes and $45 price; Holy Cobra/grey tee $27 and brown hoodie $39; all 14 Ops product cards with fully decoded images; thumbnail zoom and positioning; no mobile overflow or browser runtime errors. Verification blocked API mutations and did not create a payment or change inventory. All 384 opening units, 38 unique DCM SKUs and the replacement photo were verified before cutover. Future stock may decrease with purchases; never replay opening counts with new request IDs.

The release is complete. Earlier pending-access/data/deployment notes below are historical.

## Release progress (supersedes earlier pending-data notes)

Network approvals restored. Applied and independently verified all 384 opening units, 38 unique DCM SKUs, the replacement 1400px staple photo, and the three 40% price reductions. Staple tee is now active in the Ops catalog. Preview MERCH_BACKEND is supabase; production cutover is pending preview verification. Both isolated Playwright desktop/mobile flows passed, including unknown-response retries. Local production build passed with webpack. Vercel's Turbopack preview failed resolving its internal Google Font module; the build command now explicitly uses the verified webpack compiler.

Implementation branch: `feature/product-inventory-editor`; released through dev to main as recorded above.

The Inventory and Products tabs now open a thumbnail grid. Each product opens its own size rows, current stock, quantity adjustments and projected totals. One action saves all entered size adjustments. Confirmed rows clear individually; interrupted requests retain their idempotency keys. An unknown response locks navigation until safely retried. The product details screen supports adding/renaming sizes and generates sequential DCM SKUs, inheriting the product's existing price for new sizes. Card actions have a dedicated, bottom-aligned row with 20px separation.

Quantity fields are **add/remove units**, not replacement totals. This uses the existing transactional adjustment RPC and requires no schema migration. Stock was not changed during this work.

## Catalog state

Earlier in this session, 13 existing Shopify products / 33 variants / 44 image references were imported into Supabase and verified through the live Ops API. The original DC staple tee draft was created with no variants and kept hidden. Opening stock is still zero; production checkout still uses Shopify. The user will provide counts after reviewing this layout.

User subsequently requested DCM01, DCM02, etc. (one code per variant) and supplied a replacement DC staple tee photo. These live changes remain pending: network access was disabled before they could be applied. The reviewed local plan is `.merch-import/sku-photo-update.json`; it maps 33 variants to DCM01–DCM33 and records the replacement PNG checksum. `scripts/prepare-merch-catalog-update.mjs --apply` applies only SKU/image fields and refuses unexpected catalog changes. Run with the production environment only when connectivity is restored; do not reset stock or re-import the full catalog.

## Preview and checks

- Interactive offline preview: `/Users/pd/Downloads/Daisy-Chain-product-editor-preview.html`. Uses actual product photos, replacement tee image and planned SKUs. All saves are simulated in memory and reset on reload.
- Rebuild with `node scripts/preview-merch-editor.mjs` using the local import files. Preview scripts and fixtures contain no credentials or customer orders.
- `node --test tests/product-editor.test.mjs`: 4 DOM integration tests covering product navigation, multi-size saves, partial rejection, lost responses, failed refreshes, renaming, SKU defaults and duplicate size prevention.
- `npm run test:merch`: 46 existing tests passed.
- TypeScript passed. Targeted ESLint passed with only the repository's expected plain-image warnings.
- Browser screenshot/local-server checks were blocked by the session sandbox (`listen EPERM`, Chromium Mach port permission denied); live Supabase access failed with DNS blocked. No browser visual verification or deployment claimed.

## Confirmed stock, sale prices and live authorization

PD approved the layout, provided opening counts, and explicitly requested pushing live ASAP. No further deployment approval is needed. The session still blocks outbound shell network access; GitHub DNS was checked again after a daemon restart and returned `ENOTFOUND`.

Confirmed stock totals: staple tee 32 (S3/M6/L12/XL8/XXL3); disco tee 18 (M4/L9/XL4/2XL1); Holy Cobra 13 (S4/M4/L4/2XL1); brown hoodie 9 (S5/M4); grey/Faded Black Daisy Tee 7 (S3/M4); CDs 65; Mini Daisy Chain 100; Daisy Chain 2.0 100; beanies 40. Total **384**. Unlisted sizes/products zero. Holy Cobra and Faded Black Daisy Tee become **$27** (was $45); brown hoodie **$39** (was $65). Staple tee is $45 and its five new sizes are DCM34–DCM38.

- `scripts/prepare-merch-opening-stock.mjs` creates `.merch-import/opening-stock-plan.json`, a transactional SQL option, and `/Users/pd/Downloads/Daisy-Chain-confirmed-stock.csv`.
- `scripts/apply-merch-opening-stock.mjs` preflights the live catalog and ledger; `--apply` uses existing RPCs with fixed request IDs. It records counts without double-adding on retry and uses absolute sale prices to avoid compounding discounts. Apply only one method (SQL or API); both use the same idempotency keys.
- The generated SQL was tested in isolated PGlite: all 384 units and 38 variants match; replay preserves counts and discounts; a subsequent sale is not replenished; an unexpected starting stock count rolls back the entire transaction.
- `scripts/prepare-merch-catalog-update.mjs --apply` still supplies the 33 existing sequential SKUs and replacement tee photo.
- Latest offline preview includes the confirmed counts, discounted prices, replacement photo, and thumbnail controls. Preview data remains simulated.

Thumbnail framing now supports zoom 1–3 and X/Y positioning 0–100 with a square live preview and reset. Framing is stored on the image JSON (`thumbnailCrop`) and validated on the product API. Shop cards, homepage shop strip, gallery thumbnails and Ops share the same rendering helper. Full product photos use contain, so the source image is never destroyed or clipped. No DB schema change is needed.

Remaining deployment: finish the production build/browser check with network and process access; reconcile remote branches; commit and push only to `dev`; verify preview, PR/merge dev→main (already authorized); apply/reverify catalog data; publish the staple draft; enable `MERCH_BACKEND=supabase` with all opening counts verified; redeploy and verify live shop prices, size availability, images, crops and Ops. The prior live catalog is still Shopify until that flag is set. Never rerun the old create-table migration or the full catalog importer after edits.

Final local validation after crop support: TypeScript passed; 47 merch tests and 5 DOM editor tests passed. The complete offline preview was loaded in JSDOM and verified to include the 14 products, staple tee's 32 units and crop controls. Production build was attempted and failed because the sandbox could not fetch the existing Google Fonts; retry the unchanged build when network access returns. Targeted lint has no errors (only expected plain-img warnings).
