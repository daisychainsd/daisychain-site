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
- **release** — title, slug, artist (ref), displayArtist (string override), additionalArtists (array of artist refs for collabs), coverArt, releaseDate, catalogNumber, releaseType, format[], tracks[] (with audioFile for WAV storage + youtubeUrl), price, embedUrl, description
- **artist** — name, slug, photo, bio, links (website, instagram, bandcamp, soundcloud)
- **event** — title, slug, date, venue, flyer, ticketUrl, lineup, description

### Key patterns
- **Multi-artist credits**: `artist` is the primary reference; `additionalArtists` is an array of refs for collaborators. ALL credited artists are displayed equally as comma-separated individually linked names.
- `displayArtist` field overrides the primary artist name for display (used mainly for remixer name on remix releases)
- GROQ: `coalesce(displayArtist, artist->name)` for fallback display name on cards
- GROQ detail query fetches `primaryArtistName`, `additionalArtists[]->{ name, slug }`, and `remixerSlug` for full artist credit rendering
- **Remix rule (`.5` catalog numbers)**: DCR#X.5 is a remix of DCR#X. The `artist` ref stays as the OG artist, `displayArtist` is the remixer, `additionalArtists` carries any other OG collaborators. UI shows: remixer, OG artist(s) — all linked equally.
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

- **ReleaseInteractive** (`src/components/ReleaseInteractive.tsx`) — release detail view: cover art, metadata, multi-artist credit links, format toggle, tracklist wrapper
- **TrackList** (`src/components/TrackList.tsx`) — audio playback, per-track download, YouTube icon links, buy button. Shows "Buy EP — $X.XX" when price > 0, "Download All" when free.
- **DownloadPanel** (`src/components/DownloadPanel.tsx`) — post-purchase: verifies Stripe session, then shows download links
- **ReleaseCard** (`src/components/ReleaseCard.tsx`) — grid card with cover art + placeholder fallback
- **MobileNav** (`src/components/MobileNav.tsx`) — hamburger menu for mobile screens
- **Header/Footer** — site-wide layout; Footer includes YouTube channel link

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

- **14 active releases** (DCR#01–DCR#23, with singles collapsed into their parent EPs, plus 2 remixes as `.5` entries)
- **Canonical reference**: `CATALOG.md` in project root — the single source of truth for all artist and release data
- Source data: WAV files from `~/Dropbox/DCR/RELEASES/`, metadata from Google Sheets (`NEW DCR METADATA`, ID: `1puynz8uXInwJOVGNpmNzWJDwVBL6Nt3JeAmtFGnORyA`)
- Artist photos sourced from `~/Dropbox/DCR/RELEASES/DCR#20 Dream Disc/Assets/ART/Dream Disc artist Assets/` (13 of 20 artists have photos)
- WAV files uploaded to Sanity file assets via `scripts/seed-tracks.mjs` and `scripts/seed-tracks-resume.mjs`
- Initial seeding via `scripts/seed.mjs` (created 20 artists + 23 releases with cover art)

### EP grouping (singles collapsed into parent EPs)
- DCR#03, 04, 06 → DCR#07 "and then i started floating EP" (4 tracks)
- DCR#08, 09 → DCR#10 "2Kids EP"
- DCR#11 → DCR#12 "URL;;irl EP" (4 tracks)
- DCR#13, 15, 17 → DCR#19 "Heartbeat EP"

### Remix releases (`.5` catalog numbers)
- DCR#02.5 "Daydream (Player Dave Remix)" — artist: Mirror Maze, displayArtist: Player Dave
- DCR#18.5 "Cocky (Coido Remix)" — artist: Mirror Maze, additionalArtists: [Niles], displayArtist: Coido

### Missing cover art
- DCR#02, DCR#10, DCR#20 (Dream Disc)

### Artists without photos
- Allegra Miles, Belay, Coido, Elohim, Monotrope, Peter Sheppard, sumthin sumthin

## What's Not Done Yet

- Per-track individual purchasing (Stripe)
- Shopify Storefront API connection (merch shop)
- Events page content
- YouTube URLs on individual tracks (field exists in schema, needs data entry in Sanity Studio)
- Missing cover art for 3 releases (DCR#02, DCR#10, DCR#20)
- Missing artist photos for 7 artists
- Parcel Sound API integration (future, low priority)

## What's Done

- Vercel deployment (auto-deploys from `main` branch)
- Mobile-responsive design with hamburger nav
- Typography/legibility polish across all pages
- Multi-artist credits with individual links
- YouTube channel link in footer
- 13 artist profile photos uploaded
- Canonical catalog data in `CATALOG.md`

## Environment

- `.env.local` has: `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `SANITY_API_TOKEN`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`, `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN`
- Sanity API token is an Editor-level token (needed for mutations/uploads)
- Google Workspace metadata accessible via `gws` CLI (see gdrive skill)

<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->
