# Isolated Merch Ops browser checks

## Automated checks

```sh
npm run test:merch
npm run test:merch-ui
npx tsc --noEmit
npm run build
```

The September 29 release passed 47 merch tests and 5 product-editor DOM tests. The DOM suite mounts the actual dashboard with synthetic API responses and covers thumbnail navigation, multi-size saving, partial rejection, unknown-response retries, failed refreshes, size/SKU editing and thumbnail crop persistence/reset. `npm run build` selects webpack, matching the verified Vercel build.

## Browser fixtures

This optional harness uses Playwright with Chromium. It exercises the actual local dashboard with synthetic API responses; all external browser requests are aborted. It does not certify live service integration. Install Playwright separately if unavailable (`npm install --no-save --package-lock=false playwright`, then `npx playwright install chromium`), or set PLAYWRIGHT_MODULE to an existing installation.

Start a dedicated local server with **all** these overrides. The project's normal .env.local contains live credentials; do not run checkout tests using it.

```sh
OPS_PASSWORD=merch-local-test MERCH_BACKEND=supabase NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-test SUPABASE_SERVICE_ROLE_KEY=local-test NEXT_PUBLIC_SANITY_PROJECT_ID='' NEXT_PUBLIC_SANITY_DATASET='' SANITY_READ_TOKEN='' SANITY_API_TOKEN='' STRIPE_SECRET_KEY=sk_test_local_fixture STRIPE_WEBHOOK_SECRET=whsec_local_fixture RESEND_API_KEY='' BEEHIIV_API_KEY='' LAYLO_API_KEY='' npm run dev -- --port 3105 --hostname 127.0.0.1
```

In another terminal:

```sh
node tests/merch-browser.cjs
node tests/merch-browser.cjs --unknown-outcome
```

Both runs check desktop/mobile rendering, CSV download, product-card navigation, the per-size inventory form and product editor. Stock inputs are signed adjustments. The default also proves a confirmed save followed by a failed refresh resets the form and permits a later identical intentional adjustment with a new key. The second run drops the first POST response and proves retry uses the same key. Screenshots go to /private/tmp/daisy-merch-desktop.png and /private/tmp/daisy-merch-mobile.png. The harness uses a fixed local test password and localhost port only.

The harness also checks the Unshipped default, removal of generic shipping instructions, and marking shipped/unshipped without tracking. Shipped orders leave the default queue and remain available under Shipped. Set `MERCH_TEST_ORIGIN` to use another dedicated local server port.

`node tests/bandcamp-browser.cjs` additionally checks the Unshipped empty state, Bandcamp/Website source filter, grouped physical items, shipped/unshipped controls, corrected-address review and Bandcamp receipt copy on desktop/mobile using isolated fixtures. Its default port is 3117; set `MERCH_TEST_ORIGIN` to match the dedicated local server. It never reads or modifies real customer orders.

## Deployed verification

Production and dev preview use the same live Supabase catalog. Do not run fixture writes, stock tests or test checkout against either. The September 29 release separately verified public prices, staple sizes, 14 authenticated Ops product cards, fully decoded product images, crop controls and mobile overflow on both deployed sites, with API mutations blocked. Crop controls were exercised without saving. Wait for image decoding before assessing screenshots; an early capture can show blank loading boxes.

That read-only verification does not prove a real paid production checkout or label purchase. See [release evidence](../MERCH-PRODUCT-EDITOR-2026-09-29.md) and [operating workflow](../MERCH-ROLLOUT.md).
