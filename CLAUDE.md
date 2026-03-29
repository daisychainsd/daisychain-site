@AGENTS.md

# Daisy Chain SD — Website Project

Daisy Chain SD is an independent electronic music label based in San Diego, run by Player Dave. This site replaces the old Squarespace site at daisychainsd.com and aims to be a self-hosted Bandcamp alternative.

## Stack

- **Next.js 16** (App Router, Turbopack) — `npm run dev` starts on localhost:3000
- **Sanity CMS v5** — embedded studio at `/studio`, project `02wrtovm`, dataset `production`
- **Tailwind CSS v4** — uses `@import "tailwindcss"` syntax (not v3 `@tailwind` directives)
- **Stripe** — test mode, handles checkout + post-purchase download verification
- **Supabase** — email+password auth, profiles + purchases tables, RLS
- **wavesurfer.js** — real waveform audio player with scrubbing (`@wavesurfer/react`)
- **ffmpeg-static** — server-side audio format conversion (WAV → MP3/FLAC/AIFF)
- **Shopify Storefront API** — not yet connected (placeholder token in .env.local)

## Architecture

### Sanity CMS
Sanity is **strictly for managing frontend website content** (releases, artists, events). The label's business operations (revenue tracking, payouts, contracts, legal, accounting) are handled separately by **Parcel Sound** — do not build management/admin features that overlap with Parcel Sound.

- `src/sanity/client.ts` — gracefully handles missing config (exports `null` client + `sanityFetch` wrapper that returns empty arrays)
- `src/sanity/image.ts` — `urlFor()` helper for Sanity image CDN
- `src/sanity/schemas/` — release, artist, event, blockContent
- `sanity.config.ts` — uses relative imports (`./src/sanity/schemas`), NOT `@/` aliases

### Schemas
- **release** — title, slug, artist (ref), displayArtist (string override), additionalArtists (array of artist refs for collabs), coverArt, releaseDate, catalogNumber, releaseType, format[], tracks[] (with audioFile for WAV storage, **previewFile** for MP3 streaming, youtubeUrl), price, physicalPrice, embedUrl, description
- **artist** — name, slug, photo, bio, links (website, instagram, bandcamp, soundcloud)
- **event** — title, slug, date, venue, flyer, ticketUrl, lineup, description

### Audio streaming architecture
- **WAV files** are the master/purchase format, stored in Sanity as `audioFile` on each track
- **MP3 preview files** (128kbps) are stored in Sanity as `previewFile` on each track — used for in-browser streaming/waveform playback
- Preview MP3s were generated via `scripts/generate-previews.mjs` — converts WAV → 128k MP3 via ffmpeg, uploads to Sanity, patches `previewFile` field
- **When adding new releases**: upload the WAV as `audioFile`, then either run `scripts/generate-previews.mjs` to auto-generate the MP3 preview, or manually upload an MP3 as `previewFile` in Sanity Studio
- TrackList uses `previewUrl` (falls back to `audioUrl`) for wavesurfer playback — real waveforms from actual audio data
- `/api/convert` route handles on-demand format conversion (WAV → MP3/FLAC/AIFF) for purchased downloads

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
| `/releases/[slug]` | Release detail — cover art, metadata, waveform TrackList |
| `/artists/[slug]` | Artist page |
| `/events` | Events listing — upcoming (hero card) + past (flyer grid) |
| `/shop` | Shopify storefront (not yet connected) |
| `/login` | Email+password login |
| `/signup` | Email+password signup |
| `/account` | User downloads dashboard — purchased releases, format selector, unlimited pass |
| `/download/[slug]?session_id=` | Post-purchase download page (legacy, may be removed) |
| `/studio` | Embedded Sanity Studio |
| `/api/checkout` | Creates Stripe checkout session (requires auth) |
| `/api/checkout-pass` | Creates Stripe session for $100 unlimited pass |
| `/api/verify-purchase` | Verifies Stripe session before allowing downloads |
| `/api/convert` | Server-side audio format conversion (WAV → MP3/FLAC/AIFF via ffmpeg) |

## Components

- **ReleaseInteractive** (`src/components/ReleaseInteractive.tsx`) — release detail view: cover art, metadata, multi-artist credit links, format toggle, buy button (between container and tracklist), release date
- **TrackList** (`src/components/TrackList.tsx`) — wavesurfer.js waveform player with real audio waveforms from MP3 previews. Play replaces title/artist text with a clickable/draggable waveform. Pre-loads wavesurfer module on mount for instant playback. Properly cleans up media elements on track switch.
- **DownloadPanel** (`src/components/DownloadPanel.tsx`) — post-purchase: verifies Stripe session, then shows download links
- **ReleaseCard** (`src/components/ReleaseCard.tsx`) — grid card with cover art + placeholder fallback. Title strips "EP"/"Album" suffix since release type is shown elsewhere.
- **CatalogGrid** (`src/components/CatalogGrid.tsx`) — homepage release grid with optional physical format filter
- **EventsToggle** (`src/components/EventsToggle.tsx`) — client-side upcoming/past tab toggle for events page
- **FormatToggle** (`src/components/FormatToggle.tsx`) — digital/physical/vinyl format switcher pill
- **MobileNav** (`src/components/MobileNav.tsx`) — hamburger menu for mobile screens, includes auth-aware account/login link
- **AuthNavLink** (`src/components/AuthNavLink.tsx`) — conditional Account/Login link based on Supabase auth state
- **AccountClient** (`src/components/AccountClient.tsx`) — downloads dashboard UI with format selector and unlimited pass CTA
- **Header/Footer** — site-wide layout; Footer includes YouTube channel link

## Events

- All events are at **Spin Nightclub** in San Diego
- Tickets sold via **Shotgun** — venue page: https://shotgun.live/en/venues/daisy-chain
- Each event has its own Shotgun URL (e.g. `https://shotgun.live/en/events/daisy-chain-28-w-lyny`)
- Each event document in Sanity has a `ticketUrl` field — set to the specific Shotgun event page
- Events page splits into **Upcoming** (hero card with large flyer + ticket CTA) and **Past** (flyer grid)
- Lineup entries can optionally reference a DCR artist profile for linking

## Stripe Integration

- Test mode key in `.env.local` as `STRIPE_SECRET_KEY`
- Checkout flow: Buy button → `/api/checkout` (creates session, requires Supabase auth) → Stripe hosted checkout → `/account?purchased={slug}` → downloads visible in account dashboard
- Unlimited pass: $100 one-time purchase for all current + future downloads → `/api/checkout-pass`
- Test card: `4242 4242 4242 4242`

## Supabase Auth

- Email+password authentication via `@supabase/ssr` for Next.js App Router
- `src/lib/supabase/client.ts` — browser client (graceful null if env vars missing)
- `src/lib/supabase/server.ts` — server client with cookie handling
- `src/lib/supabase/admin.ts` — service role client for admin operations
- `src/proxy.ts` — Next.js 16 proxy file: refreshes auth tokens, protects `/account`, redirects authenticated users from `/login`/`/signup`
- Database tables: `profiles` (auto-created on signup via trigger), `purchases` (release_slug, purchased_at, unlimited_pass boolean)
- Schema: `supabase-schema.sql` in project root
- All Supabase clients gracefully handle missing env vars (return null, components show fallback UI)

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

## Typography & Design System

- **Headings**: Azo Sans Web (Black, weight 900) via Adobe Typekit (`https://use.typekit.net/ecz5lqw.css`)
- **Body text**: Azo Sans Web, fallback to IBM Plex Sans (Google Fonts)
- **Labels** (catalog numbers, toggles, uppercase metadata): Azo Sans Web via `--font-label` CSS variable
- **Code/mono**: IBM Plex Mono (Google Fonts)
- **Fallback fonts**: Outfit, IBM Plex Sans, IBM Plex Mono loaded via `next/font/google`
- **CSS design tokens**: defined in `@theme` block in `globals.css` — colors, radii, typography scale
- **`data-label` attribute**: applies label font styling via CSS (`[data-label]` selector in globals.css)
- **Transitions**: all hover transitions use scoped properties (`transition-colors`, `transition-[filter]`, etc.) — never `transition-all` to prevent layout jank
- **Buy button**: static pill showing format + price (e.g. "Buy Digital — $7.00"), positioned between main container and tracklist

## What's Not Done Yet

- Per-track individual purchasing (Stripe)
- Shopify Storefront API connection (merch shop)
- YouTube URLs on individual tracks (field exists in schema, needs data entry in Sanity Studio)
- Missing cover art for 3 releases (DCR#02, DCR#10, DCR#20)
- Missing artist photos for 7 artists
- Stripe webhook for recording purchases to Supabase (`checkout.session.completed`)
- Parcel Sound API integration (future, low priority)

## What's Done

- Vercel deployment (auto-deploys from `main` branch)
- Mobile-responsive design with hamburger nav
- Typography/legibility polish across all pages (Azo Sans Web + scoped transitions)
- Multi-artist credits with individual links
- YouTube channel link in footer
- 13 artist profile photos uploaded
- Canonical catalog data in `CATALOG.md`
- Events page with 3 events (DC#26, DC#27, DC#28) — flyers, lineups, venue data
- Waveform audio player (wavesurfer.js) with real waveforms from MP3 previews
- MP3 preview files generated and uploaded for all 45 tracks
- User accounts (Supabase auth) with login/signup/account pages
- Downloads dashboard with format selector (WAV/FLAC/AIFF/MP3)
- Unlimited pass ($100) checkout flow
- Server-side audio format conversion via ffmpeg
- Buy button UX: shows format + price, positioned below main container
- Clean CSS: removed dead classes, scoped all transitions, consistent font system

## Environment

- `.env.local` has: `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `SANITY_API_TOKEN`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`, `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Sanity API token is an Editor-level token (needed for mutations/uploads)
- Supabase keys are from the Supabase dashboard (project settings → API)
- Google Workspace metadata accessible via `gws` CLI (see gdrive skill)

## Scripts

- `scripts/seed.mjs` — initial seeding of 20 artists + 23 releases with cover art
- `scripts/seed-tracks.mjs` / `scripts/seed-tracks-resume.mjs` — upload WAV files to Sanity
- `scripts/generate-previews.mjs` — **run this when adding new releases** — converts WAV → 128k MP3, uploads to Sanity as `previewFile` on each track. Skips tracks that already have a preview.
- `scripts/upload-artist-photos.mjs` — bulk upload artist photos
- `scripts/upload-event-data.mjs` — upload event flyers and create event documents

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
