@AGENTS.md

# Daisy Chain SD — Website Project

## Branching & Deployment Workflow

**Always build and test on `dev` first. Never push to `main` until the feature looks correct on localhost.**

```
dev branch  →  test on localhost:3000  →  happy with it?  →  merge to main  →  Vercel auto-deploys
```

- **Active dev branch**: `dev` — all new work goes here
- **Production branch**: `main` — Vercel auto-deploys on every push to `main`
- **Rule**: Only merge `dev` → `main` when explicitly asked to deploy/go live
- **Local dev server**: `npm run dev` (Turbopack, localhost:3000)
- **Before merging to main**: run `npm run build` locally to catch TypeScript/build errors before Vercel sees them
- **Merging to main**:
  ```bash
  git checkout main && git merge dev && git push origin main && git checkout dev
  ```
- **Vercel env vars**: All keys from `.env.local` must also exist in Vercel → Project → Settings → Environment Variables for production to work. Use "Import .env File" to bulk-add them.
- **Sanity CDN**: `useCdn` is `false` in dev (live API, instant Studio updates) and `true` in production (cached, faster)

Daisy Chain SD is an independent electronic music label based in San Diego, run by Player Dave. This site replaces the old Squarespace site at daisychainsd.com and aims to be a self-hosted Bandcamp alternative.

## Stack

- **Next.js 16** (App Router, Turbopack) — `npm run dev` starts on localhost:3000
- **Sanity CMS v5** — embedded studio at `/studio`, project `02wrtovm`, dataset `production`
- **Tailwind CSS v4** — uses `@import "tailwindcss"` syntax (not v3 `@tailwind` directives)
- **Stripe** — test mode, handles checkout + post-purchase download verification
- **Supabase** — email+password auth, profiles + purchases tables, RLS
- **wavesurfer.js** — real waveform audio player with scrubbing (`@wavesurfer/react`)
- **ffmpeg-static** — server-side audio format conversion (WAV → MP3/FLAC/AIFF)
- **Shopify Storefront API** — headless product data/inventory for `/shop`
- **Shopify Admin API** — creates draft orders after physical purchase (fulfillment via Pirate Ship)
- **beehiiv** — newsletter email collection via API (publication: "Daisy Chain Mail")

## Architecture

### Sanity CMS
Sanity is **strictly for managing frontend website content** (releases, artists, events). The label's business operations (revenue tracking, payouts, contracts, legal, accounting) are handled separately by **Parcel Sound** — do not build management/admin features that overlap with Parcel Sound.

- `src/sanity/client.ts` — gracefully handles missing config (exports `null` client + `sanityFetch` wrapper that returns empty arrays)
- `src/sanity/image.ts` — `urlFor()` helper for Sanity image CDN
- `src/sanity/schemas/` — release, artist, event, blockContent
- `sanity.config.ts` — uses relative imports (`./src/sanity/schemas`), NOT `@/` aliases

### Schemas
- **release** — title, slug, artist (ref), displayArtist (string override), additionalArtists (array of artist refs for collabs), coverArt, releaseDate, catalogNumber, releaseType, format[], tracks[] (with audioFile for WAV storage, **previewFile** for MP3 streaming, youtubeUrl), price, physicalPrice, **shopifyHandle** (links to Shopify product for physical format purchases), embedUrl, description
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
| `/` | Homepage — hero slideshow (latest release, next event, shop) + newsletter signup + release catalog grid |
| `/releases/[slug]` | Release detail — cover art (or product photos for physical), metadata, waveform TrackList |
| `/artists/[slug]` | Artist page |
| `/events` | Events listing — upcoming (hero card) + past (flyer grid) |
| `/shop` | Physical merch grid (vinyl, shirts — fetched from Shopify Storefront API) |
| `/shop/[handle]` | Product detail — image gallery, variant/size selection, add to cart |
| `/shop/checkout` | Embedded Stripe Checkout (address, shipping, payment — all inline) |
| `/shop/checkout/success` | Order confirmation page, clears cart |
| `/login` | Email+password login |
| `/signup` | Email+password signup |
| `/account` | User downloads dashboard — purchased releases, format selector, unlimited pass |
| `/download/[slug]?session_id=` | Post-purchase download page (legacy, may be removed) |
| `/studio` | Embedded Sanity Studio |
| `/api/checkout` | Creates Stripe checkout session (requires auth) |
| `/api/checkout-pass` | Creates Stripe session for $100 unlimited pass |
| `/api/verify-purchase` | Verifies Stripe session before allowing downloads |
| `/api/checkout-physical` | Creates Stripe Embedded Checkout session for physical products with shipping |
| `/api/convert` | Server-side audio format conversion (WAV → MP3/FLAC/AIFF via ffmpeg) |
| `/api/shopify-product` | GET endpoint returning Shopify product data by handle (used by ReleaseInteractive for physical format display) |
| `/api/newsletter` | POST endpoint — subscribes email to beehiiv newsletter (Daisy Chain Mail) with UTM tracking |

## Components

- **ReleaseInteractive** (`src/components/ReleaseInteractive.tsx`) — release detail view: cover art (swaps to Shopify product photos when physical format active, with arrow navigation + dot indicators), metadata, multi-artist credit links, format toggle, "includes digital files" note, buy button (between container and tracklist), release date. Physical buy button adds to cart; digital buy button goes to Stripe checkout.
- **TrackList** (`src/components/TrackList.tsx`) — wavesurfer.js waveform player with real audio waveforms from MP3 previews. Active track shows title/artist at normal size on the left with waveform inline to the right. Pre-loads wavesurfer module on mount for instant playback. Properly cleans up media elements on track switch.
- **DownloadPanel** (`src/components/DownloadPanel.tsx`) — post-purchase: verifies Stripe session, then shows download links
- **ReleaseCard** (`src/components/ReleaseCard.tsx`) — grid card with cover art + placeholder fallback. Title strips "EP"/"Album" suffix since release type is shown elsewhere.
- **CatalogGrid** (`src/components/CatalogGrid.tsx`) — homepage release grid with optional physical format filter
- **EventsToggle** (`src/components/EventsToggle.tsx`) — client-side upcoming/past tab toggle for events page
- **FormatToggle** (`src/components/FormatToggle.tsx`) — digital/physical/vinyl format switcher pill
- **MobileNav** (`src/components/MobileNav.tsx`) — hamburger menu for mobile screens, includes auth-aware account/login link
- **AuthNavLink** (`src/components/AuthNavLink.tsx`) — conditional Account/Login link based on Supabase auth state
- **AccountClient** (`src/components/AccountClient.tsx`) — downloads dashboard UI with format selector and unlimited pass CTA
- **CartProvider** (`src/components/CartProvider.tsx`) — React context + localStorage for shop cart state
- **CartDrawer** (`src/components/CartDrawer.tsx`) — slide-out cart drawer with quantity controls
- **CartButton** (`src/components/CartButton.tsx`) — header cart icon with item count badge
- **HeroSlideshow** (`src/components/HeroSlideshow.tsx`) — homepage hero: 3 auto-advancing crossfade slides (latest release, next event, shop/merch) with dot indicators, pause on hover/touch, mobile-first
- **NewsletterSignup** (`src/components/NewsletterSignup.tsx`) — email signup form that POSTs to `/api/newsletter` (beehiiv). Sits between hero and catalog grid on homepage.
- **Header/Footer** — site-wide layout; Footer includes YouTube channel link, Header includes cart icon

## Events

- All events are at **Spin Nightclub** in San Diego
- Tickets sold via **Shotgun** — venue page: https://shotgun.live/en/venues/daisy-chain
- Each event has its own Shotgun URL (e.g. `https://shotgun.live/en/events/daisy-chain-28-w-lyny`)
- Each event document in Sanity has a `ticketUrl` field — set to the specific Shotgun event page
- Events page splits into **Upcoming** (hero card with large flyer + ticket CTA) and **Past** (flyer grid)
- Lineup entries can optionally reference a DCR artist profile for linking

## Stripe Integration

- Test mode key in `.env.local` as `STRIPE_SECRET_KEY`
- **Digital checkout**: Buy button → `/api/checkout` (requires Supabase auth) → Stripe hosted checkout → `/account?purchased={slug}` → downloads visible in dashboard
- **Physical checkout**: Cart → `/shop/checkout` → Stripe Embedded Checkout (inline on page, collects shipping address) → `/shop/checkout/success`
- **Unlimited pass**: $100 one-time purchase for all current + future downloads → `/api/checkout-pass`
- **Webhook** (`/api/webhooks/stripe`): handles `checkout.session.completed` — records digital purchases to Supabase, creates Shopify draft orders for physical purchases
- Test card: `4242 4242 4242 4242`

## Shopify Integration (Physical Products)

- **Storefront API** (`src/lib/shopify.ts`): fetches products, variants, images, inventory for the shop pages. Read-only, public token. Also used by release pages to fetch product photos for physical formats via `getProductByHandle()`.
- **Admin API** (`src/lib/shopify-admin.ts`): creates draft orders after Stripe payment. Requires `SHOPIFY_ADMIN_ACCESS_TOKEN` (create via Shopify admin > Settings > Apps > Develop apps).
- **Release → Shopify linking**: Releases with physical formats have a `shopifyHandle` field in Sanity that maps to a Shopify product. Currently linked: Dream Disc CD (`dream-disc-cd`), and then i started floating vinyl (`and-then-i-started-floating-vinyl`).
- **Flow**: Customer browses → adds to cart → Stripe Embedded Checkout (with shipping) → payment → webhook creates Shopify draft order → fulfill via Pirate Ship
- **Shipping tiers**: Standard ($5.99, 5-7 days), Priority ($9.99, 2-3 days), International ($15.99, 7-14 days) — defined in `/api/checkout-physical`
- Physical checkout does NOT require Supabase auth (guest checkout)

## Newsletter (beehiiv)

- **Publication**: "Daisy Chain Mail" (`pub_c63c3433-d698-4e9b-b9cc-de4a2af0b2ed`)
- **API route**: `/api/newsletter` — server-only, uses `BEEHIIV_API_KEY`
- **UTM tracking**: `utm_source: "daisychainsd.com"`, `utm_medium: "website"`, `utm_campaign: "homepage_signup"`
- **Frontend**: `NewsletterSignup` component on homepage (between hero and catalog grid)
- No Supabase involvement — emails go directly to beehiiv via their v2 API

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

## Design References & UI Agent

### UI Design Agent
When making **any UI or visual design decision** — layout, spacing, component shape, color usage, interaction patterns, accessibility — **always consult `ui-designer.md`** in the project root. Follow its execution flow and design principles.

### Design System References
The `design-md/` folder in the project root contains `DESIGN.md` files from 58 real-world design systems (Spotify, Stripe, Apple, Linear, Notion, Vercel, Supabase, Sanity, etc.), sourced from [awesome-design-md](https://github.com/VoltAgent/awesome-design-md).

**When making design decisions, consult relevant files:**
- **Music/streaming UI**: `design-md/spotify/DESIGN.md`
- **Checkout/payment flows**: `design-md/stripe/DESIGN.md`
- **Dark, minimal product UI**: `design-md/linear.app/DESIGN.md`, `design-md/raycast/DESIGN.md`
- **Content/editorial layouts**: `design-md/notion/DESIGN.md`
- **Developer tools / data-dense UI**: `design-md/vercel/DESIGN.md`, `design-md/supabase/DESIGN.md`
- **CMS/studio UI**: `design-md/sanity/DESIGN.md`
- **E-commerce / product pages**: `design-md/stripe/DESIGN.md`, `design-md/coinbase/DESIGN.md`
- **Events / tickets**: `design-md/airbnb/DESIGN.md`
- **Brand/luxury**: `design-md/apple/DESIGN.md`, `design-md/ferrari/DESIGN.md`

Do not blindly copy a single design system — instead cross-reference the most relevant ones and apply patterns that fit the Daisy Chain brand (dark, electronic music label aesthetic).

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
- YouTube URLs on individual tracks (field exists in schema, needs data entry in Sanity Studio)
- Missing cover art for 3 releases (DCR#02, DCR#10, DCR#20)
- Missing artist photos for 7 artists
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
- Buy button UX: shows format + price, positioned below main container; physical buy adds to cart, digital goes to Stripe
- Clean CSS: removed dead classes, scoped all transitions, consistent font system, `animate-fade-in` keyframe for image transitions
- Physical merch shop: product grid, detail pages, variant selection, cart, embedded Stripe checkout
- Shopify Admin API integration for automatic draft order creation after purchase
- Release ↔ Shopify product linking: `shopifyHandle` field on releases connects to Shopify products for physical format purchases
- Physical format UX on release pages: cover art swaps to Shopify product photos (arrow nav + dots), "All physical purchases include downloadable digital files" note, Buy CD/Vinyl button adds to cart
- Inline waveform layout: active track shows title/artist at normal size with waveform to the right (not stacked)
- Stripe webhook handles both digital (records to Supabase) and physical (creates Shopify draft order) purchases
- Shopify Storefront API fully connected with real credentials
- Homepage hero slideshow: 3 auto-advancing crossfade slides (latest release, next event, shop), mobile-first, pause on hover/touch
- Newsletter signup (beehiiv integration): email form on homepage, POSTs to `/api/newsletter`, UTM-tracked as `daisychainsd.com / website / homepage_signup`

## Layout & Styling Rules

These conventions must be followed when adding any new page or component.

### Page wrapper pattern
Every new page gets a single outer wrapper — pick the right max-width for the content type:
- **Editorial content** (releases, artists, events, account): `max-w-5xl mx-auto px-6 py-12`
- **Catalog / shop grids** (music, shop, shop detail): `max-w-7xl mx-auto px-6 py-12`
- **Focused flows** (checkout, success): `max-w-4xl` or `max-w-2xl` as appropriate
- **Auth forms** (login, signup): `max-w-md` centered via flexbox on the section

Always include `mx-auto` and `px-6`. Never use `px-4` on page content (header is the only exception to mobile padding — it now also uses `px-6`).

### Decorative blobs
Blobs use `position: absolute` with negative offsets (e.g. `right-[-150px]`). Any container that holds a blob **must** also have `overflow-hidden` to prevent horizontal scroll on narrow viewports. Pattern:
```tsx
<div className="max-w-5xl mx-auto px-6 py-12 relative overflow-hidden">
  <div className="blob w-[400px] h-[400px] bg-blue-300 top-[-100px] right-[-150px] animate-drift" />
  ...
</div>
```

### Background zones
- **Do not use `zone-deep` or `zone-abyss`** on page sections — these solid fills block the DC28 background image that shows on all pages. The page background color comes from `body` (`--color-bg-deep`) and the fixed background image in `layout.tsx`.
- The only dark-surface containers should be `container-organic` cards, not full-section backgrounds.

### Flex/grid overflow safety
- CSS grid items (e.g. `ReleaseCard`) must have `min-w-0` on their root element so truncation works correctly.
- Any `shrink-0` title block inside a flex row must also have `max-w-[45%] min-w-0` so it cannot squeeze adjacent flex-grow elements (e.g. waveform in TrackList) to zero on narrow viewports.

### Transitions
- Never use `transition-all` — always scope to specific properties (`transition-colors`, `transition-[transform]`, etc.) to prevent layout jank.

### Images
- All images use plain `<img>` tags (not `next/image`) to avoid Sanity CDN hostname config issues.
- Cover art containers use `aspect-square` alone — do not add `max-h-[...]` constraints that conflict with the aspect ratio.

## Environment

- `.env.local` has: `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `SANITY_API_TOKEN`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`, `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_ACCESS_TOKEN` (server-only duplicates to bypass Turbopack caching), `SHOPIFY_ADMIN_ACCESS_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BEEHIIV_API_KEY`
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
