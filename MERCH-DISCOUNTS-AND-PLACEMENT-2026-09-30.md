# Merch discounts and CMS product placement — September 30, 2026

## Release verification

Implementation: [PR #30](https://github.com/daisychainsd/daisychain-site/pull/30), merge `7cc07634f308391fd167c98f90c15de140889ed2`. Production deployment: `dpl_9ipZE8AQiEZQGnAFV71dwk3u6BkC`. The additive discount migration was applied and verified before release. Read-only production Chromium checks at 1440px and 390px verified all three red 40% OFF badges, crossed-out $45/$65 prices, effective $27/$39 prices, and an available initial hoodie size. No live order or inventory mutation was performed.

## Behavior

Ops is authoritative for names, handles, images, stock, regular prices and discounts. The optional discount section below size/price inputs applies 1–99% to all sizes, previews effective prices and restores regular prices when disabled. Reopening and resaving preserve the original prices. Public cards and product pages share crossed-out originals, clear effective prices and a red percentage badge. The confirmed offers are $45→$27 for Holy Cobra and Faded Black Daisy Tee, and $65→$39 for Brown DC Hoodie. The first available size is selected initially.

Sanity stores independent ordered product-ID selections in Homepage and Shop, resolved against current Ops data. Products are not copied into a second catalog, and there is no synchronization cron. Arrange the list before enabling manual mode. Empty manual lists intentionally hide the section; automatic homepage mode displays four items, while a manual list displays the exact selection. Homepage changes are live-edit; Shop requires Publish. Published sold-out products may still be displayed. Hidden/deleted IDs are skipped. Placement removal does not unpublish a direct product page. Shop falls back to published Ops products if Sanity lookup fails.

## Storage and deploy order

Apply only `scripts/merch-discounts-2026-09-30.sql`, then deploy the code. Product `discount_percent` and variant `compare_at_price_cents` preserve the offer; variant `price_cents` is always the server checkout amount. The RPC computes effective cents from explicit regular prices, rejects rounding that produces zero or no reduction, preserves stock, and requires every existing size. The seed only recognizes all-size $27/$39 prices on the three confirmed handles and never changes their prices or stock. Subsequent migration runs do not re-enable disabled offers. The fresh-install schema contains the same migration.

Old server code can still edit descriptions/photos at unchanged sale prices after the migration. It cannot alter prices or add a size on an active sale. Old browser tabs posting to the new API must reload; they cannot accidentally double-discount. Never roll back the database by dropping columns; existing checkout continues reading effective prices. Rolling code back hides the badges and removes discount controls, but does not restore regular prices. Manage active offers in the new editor before a rollback if needed.

## Validation and adversarial review

53 merch/SQL/API tests; nine editor/CMS/storefront DOM tests; TypeScript; production webpack build; Sanity schema extraction. Isolated Chromium at 1440px and 390px covered Ops editing and saves, homepage/shop ordering, sale values, decoded images, no overflow/runtime errors and adding a selected sale size to cart. Browser writes used local fixtures; no live checkout/order/inventory mutation was used for testing.

Actual Claude Code review initially returned NO SHIP for an old Ops tab being able to submit an effective price as a regular price. Explicit `regular_price_cents` and a regression test fixed it. Follow-up returned SHIP. Other findings addressed: Sanity outage fallback, false New badges under manual ordering, deliberate homepage live-edit behavior, schema parity, mixed-size price ranges, public catalog caching, loading/error labels and retaining the chosen percentage across an unsaved off/on toggle. Browser QA additionally found and fixed the hoodie opening on an unavailable first size.

## Limits

Pages revalidate at 60 seconds; Studio refreshes its public product list on focus/every minute with short caching. Existing Stripe promotion codes may stack with catalog discounts. Persisted carts may display an older price until refreshed, but checkout reads current server prices. Stock is checked without reservations; the existing shortage-hold behavior remains. Bandcamp and booth stock are separate manual adjustments. This release does not change these established policies.

## Product-detail crop follow-up

Commit `457bac71fb458cb379768b4fefdf7664680f7a1a` applies each selected image's saved framing to the large product-detail image, matching shop cards. Original files are unchanged; switching to an uncropped image clears zoom and position and restores full-photo containment. The regression failed before the fix and passed afterward. All nine UI tests and the production build passed; actual Claude review returned SHIP.

Production deployment `dpl_GvPsgNTtJFKUuySzh4f64uzFDVEY` is Ready on the main domain. Read-only Chromium at 1440px and 390px verified the saved 1.25× crop, square clipping, gallery reset, and no overflow or runtime errors. Deployed Studio JavaScript includes both product selectors and manual-ordering controls.

## Current publishing policy

Requested changes publish to `main` after appropriate local checks and review. PD explicitly set this standing default on September 30, 2026; use `dev` only when PD asks to test there first. Do not ask again for routine go-live authorization already covered by the requested work. Handle GitHub operations directly: an ordinary fast-forward push or admin PR merge is authorized with the existing owner credentials. Preserve branch protections and never force-push.

PR #30 used the earlier dev-to-main route. This standing policy supersedes earlier release-specific approval and dev-first instructions; historical audit documents retain their original checkpoint findings.

The follow-up Claude documentation review returned SHIP. Its stale historical-branch banner, retired download-verification route references and hourly-cron wording findings were corrected before the docs commit.

## In-stock picker follow-up

The Sanity picker now offers only published products with at least one available size. An already-selected product that sells out retains its ID and a disabled, labeled option so editors can replace or remove it. Restocking makes it selectable again on refresh. An empty in-stock list explains how to restock/publish in Ops. This changes CMS choices, not storefront publication or saved placement records.

Follow-up validation: all nine UI tests passed, including sold-out choice filtering, preserving a saved sold-out ID, the empty-stock message and restocking. The 53 merch tests, TypeScript and the full production webpack build also passed. Claude adversarial review of `224c8ea`: SHIP, no code changes required. Known, accepted limits: the picker list can lag Ops stock by up to about a minute (30-second client cache plus the short API cache), and a product already used in another row is still offered, with the existing "Choose each product only once" validation catching the duplicate.

Deployed September 30, 2026: `224c8ea0578a8380e1e4aa3b3951cae118821400` fast-forwarded to `main`; Vercel production deployment `daisychain-site-rekfg4ung` is Ready and aliased to `www.daisychainsd.com`. Read-only live checks: `/` and `/shop` return 200, and `/api/merch-products` returned 14 published products, 10 with an available size and 4 sold out (the 4 are therefore not offered as new picker choices). The Studio picker itself was not exercised in a logged-in browser session.

## Add-all follow-up

The product list in Studio now has an **Add all in-stock products not yet listed** button above it. One click appends every published, in-stock product that is missing from the list; the native Studio drag handles then set the order and the row menu removes unwanted items. Row pickers also exclude products already placed in another row, so a product can no longer be chosen twice; the existing duplicate validation remains as a backstop. Sold-out products are not added by the button, consistent with the in-stock picker. No schema shape, storefront or data change: saved lists keep the same `productId` entries.

Validation: nine UI tests (the placement test now covers add-all and sibling exclusion), 53 merch tests, TypeScript and the production webpack build.

Deployed September 30, 2026: `a5508c8469ae0c8848b5136116294be5c28b4446` fast-forwarded to `main`; Vercel production deployment `daisychain-site-c7ao4g3l5` is Ready and aliased to `www.daisychainsd.com`. `/shop` returns 200 and `/studio` returns its expected 401 auth challenge. No separate adversarial review was run on this follow-up. The button was not clicked in a logged-in Studio session; behaviour is covered by the DOM test. Known limit: the button does not remove empty "Choose a product" rows; delete those from the row menu.

## Trucker hat photo replacement

Also on September 30, the Black DC Trucker Hat's single photo was replaced with the new front-on "Planted in San Diego" product shot (source: Dropbox `MERCH/DAISYCHAIN_PRODUCT/PLANTED HAT/DC HAt.PNG`, 1241×1268 PNG, stored as `merch-images/d18e968b-789c-4ac1-beb0-872eeb634da6.png`). The previous file (`b967a064…e800.jpg`) was deleted from the `merch-images` bucket after confirming no other product or order referenced it. This was a direct Supabase data change with no code or deploy; the product page and `/api/merch-products` were verified serving the new image. No thumbnail framing is saved for it; adjust in Ops → Edit product & sizes if needed.

## Current state after these follow-ups

`main` and production are at the add-all commit plus this documentation. Ops remains the source for products, photos, stock, prices and discounts; Sanity stores only ordered product IDs for Homepage and Shop. At verification the published catalog had 14 products, 10 with an available size.

