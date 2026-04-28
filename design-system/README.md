# Daisy Chain Design System

> Design system for **Daisy Chain Records** — an independent electronic music label and intimate dance floor based in San Diego, CA. Run by Player Dave. Home to Dream Disc, Player Dave, Mirror Maze, JOIA, Crosstalk, Canary Yellow, Next To Blue and more.

This system powers the daisychainsd.com website, Shotgun event flyers, Sanity CMS studio content, Stripe/Shopify checkout, and the in-venue visual world at **Spin Nightclub, San Diego**.

---

## Sources

- **Codebase:** `github.com/daisychainsd/daisychain-site` (Next.js 16 + Tailwind v4 + Sanity v5). Key files read during authoring:
  - `src/app/globals.css` — tokens, container primitives, keyframes
  - `src/app/layout.tsx` — root shell, fonts, `site-bg` background image
  - `src/app/page.tsx` — homepage structure (Hero → Shows → Music → Newsletter → Catalog)
  - `src/components/*` — Header, Footer, ReleaseCard, UpcomingEventCard, TrackList, FormatToggle, NewsletterSignup
  - `CLAUDE.md`, `CATALOG.md`, `ui-designer.md` — brand + catalog authoritative docs
- **Brand assets imported:** `PD-FlowerOutlined_White_2021.png`, `flower-white.png`, `flower-blue.png`, `hero.png`, `bg-dc28-landscape.webp`, `bg-dc28-portrait.webp`, `dc28-flyer-landscape.png` (all in `assets/`)
- **Live site:** [daisychainsd.com](https://daisychainsd.com)
- **Typekit (canonical heading face):** `https://use.typekit.net/ecz5lqw.css` — kit ID `ecz5lqw`, serves **azo-sans-web Black**.

> ⚠️ **Font substitution.** Azo Sans Web is Adobe Typekit only and can't be redistributed. Prototypes + decks in this design system fall back to **Archivo Black** / **Archivo 900** (Google Fonts) — visually very close, same geometric-grotesque DNA. When deploying to production, include the Typekit link and Azo Sans Web takes over automatically. **Please confirm or provide a licensed Azo Sans Web web font kit if the substitution is not acceptable.**

---

## Index

```
/
├── README.md                  ← you are here
├── SKILL.md                   ← Agent Skill manifest
├── colors_and_type.css        ← tokens + primitives (the one file to import)
├── assets/                    ← logos, flyers, hero imagery, backgrounds
│   ├── flower-white.png       ← primary logomark (white fill)
│   ├── flower-blue.png        ← retired — do not use
│   ├── flower-outlined.png    ← outlined mark (light backgrounds)
│   ├── hero.png               ← DAISY CHAIN stadium-font homepage hero
│   ├── bg-dc28-landscape.webp ← fixed chrome-liquid site background
│   ├── bg-dc28-portrait.webp  ← mobile orientation
│   └── dc28-flyer.png         ← reference flyer (DC #28 w/ LYNY)
├── preview/                   ← Design System card HTML (registered assets)
└── ui_kits/
    └── website/               ← daisychainsd.com recreation
        ├── README.md
        ├── index.html         ← click-thru prototype (home → release → event)
        └── *.jsx              ← Header, Footer, ReleaseCard, TrackList, etc.
```

---

## Content Fundamentals

Daisy Chain writes the way a label runs a 300-cap room — tight, warm, factual, no marketing vapor. Copy is confident but not salesy; the brand trusts the music and the flyer to do the talking.

**Voice:** First person plural + direct you. "We'll keep you posted." "Stay up to date with events, music, and more." Never corporate ("our customers"), never hype ("🔥 don't miss out").

**Tone:** intimate, knowing, San Diego. It is a dance floor first, a label second. Copy never oversells; it names the thing and moves on ("Independent electronic music label based in San Diego, California." — full stop, no adjectives).

**Casing:** Section headings are **uppercase black weight** ("SHOWS", "MUSIC", "UPCOMING"). Metadata labels are uppercase with letter-spacing (`data-label`). Release + track titles are **Title Case As Delivered** — never auto-capitalized ("and then i started floating EP" stays lowercase because the artist wrote it that way). Catalog numbers are `DCR#XX` style, monospace.

**Emoji:** None. There is no emoji anywhere in the codebase copy. Icons are drawn as SVG or represented by a pill + text. The brand mark itself — the daisy — functions as the only "emoji."

**Copy samples:**
- Homepage CTA: *"Stay up to date with events, music, and more"* / *"Subscribe"* / success state: *"You're in!"*
- Buy button: *"Buy Digital — $7.00"* (format name + em-dash + price; no "Add to cart!")
- Upcoming: *"Coming Soon"* badge + *"Pre-save"* button — never "Save the date ⭐"
- Event card: `FRI` / `MAY 8` / `2026` stacked in blue mono, then the act name huge, venue small, a **Get Tickets** pill. Lineup is a plain list of links.
- Footer: `© 2026 Daisy Chain Records. San Diego, CA.`

**Specifics to keep:**
- "Daisy Chain" (two words, space) — never "DaisyChain" or "DC" except in event codes (DC#28, DCR#22).
- Release numbering: `DCR#22 "Ballerina"` — hash before number, em-dash before title.
- Remixes use `.5` — `DCR#18.5 — Cocky (Coido Remix)`.
- "Daisy Chain Mail" = the newsletter. "Daisy Chain Records" = the label. "Daisy Chain" = the party.

---

## Visual Foundations

**The feeling.** Midnight club, lights low, chrome + steel flyer stapled to a brick wall, DAISY CHAIN burning white-hot behind the crowd. This is not a techno minimalist label and it is not a pastel indie label — it's a **warm-dark, grainy, geometric-bold, asymmetric** visual system. Chrome and liquid distortion live on the flyers; the web UI is disciplined and organized so the flyers can be loud.

### Colors
- **Background.** Seven-stop dark ladder from `#060910` (abyss) → `#253244` (float). Pages sit on `--color-bg-deep` (`#0A0E14`). Cards are `--color-bg-surface`. Never pure black; always 4–6% blue cast.
- **Accent.** A single signature hue — **blue-300 `#7CB9E8`** — the flower-mark blue. Buttons, active toggles, upcoming pills, waveform progress, selection color. Blue-200 is the hover state; blue-400+ is for edge cases (heavy backgrounds, focus rings).
- **Text.** Four-stop warm white: primary `#E8ECF0`, secondary `#8899AA`, muted `#556677`, faint `#3A4A5A`. No pure white, no pure grey.
- **Secondary accents** (used sparingly, maybe once per page): amber-300 `#E8B86C`, lavender-300 `#A8A0D4`.
- **Semantic:** no red/green noise; destructive uses text-red-400 from Tailwind defaults; success uses the brand blue.

### Type
- **Azo Sans Web Black (weight 900)** for every heading and most UI chrome. Archivo Black is the Google-Font substitute used in this system.
- **IBM Plex Sans** for body + form text.
- **IBM Plex Mono** for catalog numbers (`DCR#20`), dates (`MAY 8`), labels, and data.
- Heading convention: **UPPERCASE, -0.02em to -0.03em tracking, line-height 0.9–1.1**. Section headings on the homepage are fluid `clamp(2.75rem, 10vw, 10rem)` — they get huge on desktop, always left-aligned.
- Labels use `data-label` styling: uppercase, `letter-spacing: 0.06em`, weight 700, muted color.

### Spacing & layout
- Page wrappers follow a strict convention:
  - Editorial content: `max-w-5xl mx-auto px-6 py-12`
  - Grids / shop: `max-w-7xl mx-auto px-6 py-12`
  - Focused flows: `max-w-4xl` or `max-w-2xl`
  - Auth forms: `max-w-md`
- Always `mx-auto`, always `px-6`. Never `px-4` on content.
- Sections divided by `border-t border-white/[0.06]` — a 6%-white hairline.

### Backgrounds & imagery
- A **single fixed chrome-liquid flower** (`bg-dc28-*.webp`) lives behind every page at 10% opacity, center-covered. It is the label's ambient watermark.
- **Subtle noise grain** overlay on the whole document (~3% opacity) via inline SVG `feTurbulence`. This is non-negotiable — it is what makes the UI feel analog.
- Hero imagery is **black-and-white, high contrast, grainy, photojournalism-of-the-dance-floor**. Never colorized, never tinted blue.
- Flyer imagery is **chrome-liquid B&W** with distressed italic stadium letters — see `assets/dc28-flyer.png` as the canonical reference.
- Blobs (large blurred circles of blue-300 at ~4% opacity) drift slowly behind catalog grids for depth.

### Borders, radii, shadows
- **Asymmetric organic radii** are the signature move: `24px 8px 24px 4px` (lg), etc. Cards look hand-torn, not machine-milled. The convention:
  - `container-organic` on cards that hold content
  - `container-inset` on *media wells* (cover art, flyer) — **inverse radius** so they visually "sink" into the parent
  - `container-pill-l` / `-r` on buttons — one side round, one side soft-cornered
  - `container-scoop` on stacked lists (tracklist) — square top, round bottom
- Borders are always `rgba(255,255,255,0.06)` — 6% white; strong borders go to 12%.
- Shadows are **blue-tinted**, low-opacity: the `hover-lift` utility lifts 3px and casts `rgba(124,185,232,0.08)` at 20px + `0.04` at 40px. Never drop-shadow black.

### Animation & interaction
- Global ease: `cubic-bezier(0.42, 0, 0.58, 1)` — a balanced in/out, **not** a bouncy material curve.
- Duration: **250ms** is the default. Hero fades use 1200ms.
- **Never `transition-all`** — transitions are always scoped (`transition-colors`, `transition-[filter]`) to prevent jank.
- **Hover states:** color shifts from text-secondary → blue-300, background gets a 5% blue wash. No scale-up on buttons; covers scale 1.05 on card hover only.
- **Press states:** no separate pressed styles — the brand relies on the color shift.
- **Drift/slow-spin** keyframes for decorative blobs (28s) and for the flower mark if used large (120s).
- `prefers-reduced-motion` kills all decorative animation.

### Transparency & blur
- Catalog-number pill uses `backdrop-blur-sm` over a `bg-black/50` glass — it lives on cover art.
- "Soon" badge uses `bg-blue-300/20 border border-blue-300/30 backdrop-blur-sm`.
- Protection gradients appear only on the hero: `bg-gradient-to-t from-bg-deep/60 via-transparent to-bg-deep/20`.
- Blur is otherwise rare — this system is solid cards, not glassmorphism.

---

## Iconography

Daisy Chain's icon language is **stripped-down hand-drawn SVGs + the flower logomark, nothing else**. No icon font, no emoji, no Heroicons/Lucide/FontAwesome dependency.

- **Logomark.** The six-petaled daisy is the brand. Three variants live in `assets/`:
  - `flower-white.png` — default, used in Header at 32×32 and in Footer at 20×20 @ 50% opacity
  - `flower-outlined.png` — outlined version for very light backgrounds
  - ⚠ **Do not use the blue-tinted flower.** `flower-blue.png` exists in the asset folder but is retired — the mark stays white (or outlined on light).
  - On hover the header mark gets `drop-shadow(0 0 8px rgba(124,185,232,0.5))` — a subtle blue glow.
- **SVG icons.** Drawn inline, stroke-based, `strokeWidth="2"`, sized 16–18px. Every icon in the codebase is hand-coded:
  - Play: filled triangle `M4 2l10 6-10 6V2z`
  - Pause: two `<rect>` bars
  - Arrow: `M3 8h10m0 0l-4-4m4 4l-4 4`
  - YouTube: single-path brand glyph (only branded icon in use, colored `text-red-400` on hover)
  - Cart, hamburger: small stroke-based shapes
- **Flyer glyph.** On DC28 the flower appears as a small inline ornament next to "Daisy Chain #28" — treat it like a bullet.
- **Unicode.** Em-dash `—` is used as a separator in catalog entries and buy buttons. Bullet `·` is used in event metadata. No other unicode decorations.
- **No emoji.** Ever. If you catch yourself adding one, stop and use a pill badge instead.

> If a new icon is needed that doesn't exist in the codebase, **copy the Lucide icon** closest in stroke weight (2px), same viewBox. Flag the import — we prefer to add it to `assets/icons/` rather than pull from a CDN.

---

## Using this system

Import `colors_and_type.css` at the top of any HTML artifact. All tokens, primitives, keyframes, and presets are available immediately. For React prototypes, the JSX components in `ui_kits/website/` are drop-in and reference these CSS classes.

For larger work, read `SKILL.md` — it tells an agent how to assemble designs the Daisy Chain way without reinventing the wheel.

---

## Caveats & open items (from author)

- **Azo Sans Web** is substituted with Archivo Black in this system. Provide a licensed Azo web-font kit to make prototypes match production pixel-for-pixel.
- No photos of the room itself were in the repo beyond `hero.png`; flyer + background stand in for the broader mood.
- Sanity-driven dynamic data (real releases, events) is mocked in the UI kit with representative entries from `CATALOG.md`.
