@AGENTS.md

# Daisy Chain SD — Website Project

Daisy Chain SD is an independent electronic music label based in San Diego, run by Player Dave. This site replaces the old Squarespace site at daisychainsd.com and aims to be a self-hosted Bandcamp alternative.

## Stack

- **Next.js 16** (App Router, Turbopack) — `npm run dev` starts on localhost:3000
- **Sanity CMS v5** — embedded studio at `/studio`, project `02wrtovm`, dataset `production`
- **Tailwind CSS v4** — uses `@import "tailwindcss"` syntax (not v3 `@tailwind` directives)
- **Stripe** — test mode, handles checkout + post-purchase download verification
- **Shopify Storefront API** — not yet connected (placeholder token in .env.local)

## Architecture

### Sanity CMS
Sanity is **strictly for managing frontend website content** (releases, artists, events). The label's business operations (revenue tracking, payouts, contracts, legal, accounting) are handled separately by **Parcel Sound** — do not build management/admin features that overlap with Parcel Sound.

- `src/sanity/client.ts` — gracefully handles missing config (exports `null` client + `sanityFetch` wrapper that returns empty arrays)
- `src/sanity/image.ts` — `urlFor()` helper for Sanity image CDN
- `src/sanity/schemas/` — release, artist, event, blockContent
- `sanity.config.ts` — uses relative imports (`./src/sanity/schemas`), NOT `@/` aliases

### Schemas
- **release** — title, slug, artist (ref), displayArtist (string override), coverArt, releaseDate, catalogNumber, releaseType, format[], tracks[] (with audioFile for WAV storage), price, embedUrl, description
- **artist** — name, slug, photo, bio, links (website, instagram, bandcamp, soundcloud)
- **event** — title, slug, date, venue, flyer, ticketUrl, lineup, description

### Key patterns
- `displayArtist` field overrides the artist reference name for display (e.g. "Player Dave & sumthin sumthin" instead of just "Player Dave")
- GROQ: `coalesce(displayArtist, artist->name)` for fallback display name
- All images use plain `<img>` tags (not next/image) to avoid Sanity CDN hostname config issues
- Cover art is always null-checked before calling `urlFor()`

## Pages & Routes

| Route | Purpose |
|---|---|
| `/` | Homepage — hero + release catalog grid |
| `/releases/[slug]` | Release detail — cover art, metadata, TrackList with audio playback |
| `/artists/[slug]` | Artist page |
| `/events` | Events listing (not yet populated) |
| `/shop` | Shopify storefront (not yet connected) |
| `/download/[slug]?session_id=` | Post-purchase download page (Stripe session verified) |
| `/studio` | Embedded Sanity Studio |
| `/api/checkout` | Creates Stripe checkout session |
| `/api/verify-purchase` | Verifies Stripe session before allowing downloads |

## Components

- **TrackList** (`src/components/TrackList.tsx`) — audio playback, per-track download, buy button. Shows "Buy EP — $X.XX" when price > 0, "Download All" when free.
- **DownloadPanel** (`src/components/DownloadPanel.tsx`) — post-purchase: verifies Stripe session, then shows download links
- **ReleaseCard** (`src/components/ReleaseCard.tsx`) — grid card with cover art + placeholder fallback
- **Header/Footer** — site-wide layout components

## Stripe Integration

- Test mode key in `.env.local` as `STRIPE_SECRET_KEY`
- Checkout flow: TrackList "Buy" button → `/api/checkout` (creates session) → Stripe hosted checkout → `/download/[slug]?session_id=` → `/api/verify-purchase` confirms payment → download links revealed
- Test card: `4242 4242 4242 4242`

## Pricing Model

- **$2 per track**
- **15% discount** when buying the full EP/album
- Singles: $2.00
- EPs: (track count x $2) x 0.85
- Prices are stored on each release document in Sanity (`price` field)
- Per-track purchasing is NOT yet implemented (only full release buying)

## Catalogue Data

- **14 active releases** (DCR#01–DCR#23, with singles collapsed into their parent EPs)
- Source data: WAV files from `~/Dropbox/DCR/RELEASES/`, metadata from Google Sheets (`NEW DCR METADATA`, ID: `1puynz8uXInwJOVGNpmNzWJDwVBL6Nt3JeAmtFGnORyA`)
- WAV files uploaded to Sanity file assets via `scripts/seed-tracks.mjs` and `scripts/seed-tracks-resume.mjs`
- Initial seeding via `scripts/seed.mjs` (created 20 artists + 23 releases with cover art)

### EP grouping (singles collapsed into parent EPs)
- DCR#03, 04, 06 → DCR#07 "and then i started floating EP"
- DCR#08, 09 → DCR#10 "2Kids EP"
- DCR#11 → DCR#12 "URL;;irl EP"
- DCR#13, 15, 17 → DCR#19 "Heartbeat EP"

### Missing cover art
- DCR#02, DCR#10, DCR#20 (Dream Disc)

## What's Not Done Yet

- Per-track individual purchasing (Stripe)
- Shopify Storefront API connection (merch shop)
- Events page content
- Design customization / theming
- Vercel deployment (live test URL)
- Missing cover art for 3 releases
- Parcel Sound API integration (future, low priority)

## Environment

- `.env.local` has: `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `SANITY_API_TOKEN`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`, `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN`
- Sanity API token is an Editor-level token (needed for mutations/uploads)
- Google Workspace metadata accessible via `gws` CLI (see gdrive skill)
