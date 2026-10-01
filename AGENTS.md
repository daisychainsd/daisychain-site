<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Daisy Chain Brand & Design System

## Discounts and CMS placement — September 30, 2026

Ops owns product details, photos, stock, regular prices and discounts. Sanity owns independent Homepage and Shop selections and ordering using stable Ops product IDs; it does not copy the product catalog or require a sync cron. See [MERCH-DISCOUNTS-AND-PLACEMENT-2026-09-30.md](MERCH-DISCOUNTS-AND-PLACEMENT-2026-09-30.md) for release verification and [MERCH-ROLLOUT.md](MERCH-ROLLOUT.md) for daily editing.

The release adds `merch_products.discount_percent` and `merch_variants.compare_at_price_cents`; `price_cents` remains the effective checkout price. `save_merch_product` calculates prices atomically from explicit `regular_price_cents`. Old clients without that field must reload. The additive `scripts/merch-discounts-2026-09-30.sql` is applied; do not rerun the old full schema/import/opening-stock scripts. Migration reruns never reactivate disabled offers.

Homepage selection is `homepageSettings.merch`; Shop is the `shopSettings` singleton's `merch`. Both store ordered `productId` entries and a manual-selection switch. Empty manual lists hide that section. Homepage is live-edit; Shop requires Publish. `/api/merch-products` contains public storefront fields only, cached briefly for Studio. Ops publication remains authoritative for direct product URLs. A Sanity failure falls back to the published Ops catalog on Shop. No new cron or credentials are required.

Validation: 53 merch tests, nine editor/CMS/storefront DOM tests, isolated desktop/mobile Chromium, TypeScript, production webpack build and Sanity schema extraction. Actual Claude adversarial review: SHIP after fixing the stale-client double-discount bug. Product pages initially select an available size. See the release record for exact deployment and read-only live verification.

## Live merch state — September 29, 2026

Ops/Supabase is the product, price, photo and inventory source for production and the dev preview (`MERCH_BACKEND=supabase`). The catalog import, image storage, DCM01–DCM38 SKUs, staple tee and 384-unit opening count are complete; do not rerun the old import/schema or reset current stock to that opening snapshot. Use [MERCH-ROLLOUT.md](MERCH-ROLLOUT.md) for daily editing and [MERCH-PRODUCT-EDITOR-2026-09-29.md](MERCH-PRODUCT-EDITOR-2026-09-29.md) for release evidence. Historical September 14/22 notes are not current activation instructions.

Product stock inputs are signed adjustments, not replacement totals. Thumbnail framing is optional image JSON metadata shared by Ops, shop/homepage cards, gallery thumbnails and the large product-detail image; original uploaded files remain intact. `npm run build` uses webpack; `npm run test:merch-ui` covers the product editor. Requested changes publish to `main` after appropriate local checks and review. PD explicitly set this standing default on September 30, 2026; use `dev` only when PD asks to test there first. Do not ask again for routine go-live authorization already covered by the requested work. Handle GitHub operations directly: an ordinary fast-forward push or admin PR merge is authorized with the existing owner credentials. Preserve branch protections and never force-push.

## Brand conventions

The [`design-system/`](design-system/) folder at the project root is the **canonical Daisy Chain brand**. It is not optional reference material — it is the source of truth for every visual, typographic, and interaction decision on this site.

**Required reading before any UI, copy, or visual change:**

1. [`design-system/README.md`](design-system/README.md) — brand voice, visual foundations, iconography, content fundamentals
2. [`design-system/SKILL.md`](design-system/SKILL.md) — how to assemble designs the Daisy Chain way
3. [`design-system/colors_and_type.css`](design-system/colors_and_type.css) — canonical tokens (mirrored into `src/app/globals.css`)
4. [`design-system/ui_kits/website/`](design-system/ui_kits/website/) — JSX components + click-thru prototype
5. [`design-system/preview/`](design-system/preview/) — visual lookup for buttons, colors, radii, type scale
6. [`design-system/assets/`](design-system/assets/) — canonical logomarks, hero imagery, flyer reference

**The Brand Rules section in `CLAUDE.md`** enumerates the non-negotiables (single blue accent, asymmetric radii, no emoji, ALL CAPS section heads, dark warm surfaces, Rubik Mono One for wordmarks, Archivo Black / Azo Sans Web for display, etc.). Treat it as law.

**If you add a new design token**, add it to both `design-system/colors_and_type.css` AND `src/app/globals.css` `@theme` block. They must never drift.

**Font roles (non-negotiable)** — every font usage must resolve to one of:

- `--font-wordmark` → **Rubik Mono One** → DAISY CHAIN homepage wordmark + NewsMarquee big display. Do NOT use `--font-heading` for these — the Rubik letterforms are the wordmark signature.
- `--font-heading` → Archivo Black / Azo Sans Web → section titles, h1-h6, pill labels.
- `--font-body` → Azo Sans Web / IBM Plex Sans → paragraphs, UI text.
- `--font-mono` → IBM Plex Mono → dates, catalog numbers, data.

See the "Font roles" table in `CLAUDE.md` for the full reference.
