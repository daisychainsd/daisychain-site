# Session Audit — Design System Install + Homepage V2 Port

> **SUPERSEDED by [AUDIT-session-2.md](AUDIT-session-2.md).** This file documents end of Session 1 (2026-04-22). During Session 2 (2026-04-23 → 2026-04-25), the `--card-bg` / `--card-bg-raised` translucent-token system referenced as "fixed today" in items §2 and §3 below was DELETED in a revert pass. Those items are out of date. See AUDIT-session-2 for the current state. Keeping this file as historical context for the Session 1 work.

Written after an extended session that installed the Daisy Chain Design System, ported Homepage V2, and touched 9 phases of work. The build passes and every page returns 200, but there are real issues worth flagging before the next session.

## TL;DR

**Works:** build, typecheck, every page renders, Sanity/Supabase/Stripe/Shopify wiring intact, fonts load, hero photos load, `/about` route exists with header/mobile nav link.

**Real bugs I shipped** *(ALL FIXED 2026-04-23):*

1. ~~`ReleaseSpotlight` silently never renders the release description because of a broken type check (always false).~~ ✅ Fixed — installed `@portabletext/react`, renders Portable Text properly. Plain-string path kept for defensive fallback. Also fixed singular/plural CTA wording ("Listen — 1 track" vs "Listen — 4 tracks").
2. ~~`LeadGen` inner panel uses the OLD solid `--color-bg-raised` token instead of the new translucent `--card-bg-raised`, breaking the cohesion system I built.~~ ✅ Fixed — YOUR EMAIL panel now uses `--card-bg-raised`.
3. ~~`ReleaseSpotlight` tracks-preview panel same issue — uses `--color-bg-surface` (solid) instead of `--card-bg` (translucent).~~ ✅ Fixed — tracks panel + cover-art placeholder both use the translucent tokens now.
4. ~~`WordmarkHero` has `aria-hidden` on a `<picture>` element, which ESLint flags because `<picture>` doesn't support ARIA.~~ ✅ Fixed — `aria-hidden` moved to the `<img>` child. Empty `alt` + `aria-hidden` on the `<img>` correctly removes the decorative hero photo from the accessibility tree.
5. ~~Two `any` types in `ReleaseSpotlight` interfaces.~~ ✅ Fixed — added a shared `SanityImageRef` structural type + `PortableTextBlock[]` from `@portabletext/react`. Also cleaned up two more `any` types in `src/app/page.tsx` (`UpcomingShow.flyer`, `UpcomingRelease.coverArt`) in the same pass.

**Lint after fixes:** 0 errors on the files I touched this session. Remaining warnings are just `<img>` vs `<Image />` messages — intentional per CLAUDE.md ("all images use plain `<img>` tags to avoid Sanity CDN hostname config issues").

**Design problems the user called out that I didn't fully solve:**

6. Cards over different backgrounds still look visually different because translucency means whatever-is-behind tints the card. The 94% fix mitigates but doesn't eliminate.
7. The LeadGen's inner "YOUR EMAIL" panel is fully opaque while the outer card is translucent — creates a visual inconsistency.

**Dead code I introduced and never removed:**

8. `dcWave`, `grainShift` keyframes defined but unused.
9. `.text-chrome`, `.grain`, `.text-body`, `.text-caption`, `.text-micro`, `.text-mono` utility classes defined but never referenced anywhere in the codebase.
10. `.btn-ghost` only used once in `ReleaseSpotlight`.
11. `--font-weight-body`, `--font-weight-body-bold` tokens defined but never used.
12. `--color-amber-*` and `--color-lavender-*` remain but the only usage (`/events` page) was a decorative blob.

**Structural issues:**

13. `NewsMarquee` items are hardcoded (`"DCR#22 BALLERINA"`, `"MAY 8 — LYNY LIVE"`, etc.). They will go stale as releases and events change.
14. `LeadGen` subscriber count is hardcoded as the string `"on chain"`. Never wired to beehiiv's real subscriber count.
15. `WordmarkHero` opacity value `0.55` on the hero photo is hardcoded inline.
16. Every new component is stuffed with inline `style={{ ... }}` instead of using Tailwind v4 arbitrary values or proper CSS classes. Makes every tweak a rebuild.
17. Every new component hardcodes `maxWidth: 1440` and `padding: "72px clamp(24px, 4vw, 48px)"`. Should be a shared layout primitive.
18. `SectionHeader` and `NewsMarquee` use the same kicker+copy pattern but reimplement it each time.

**UI issues the user specifically hated:**

19. I iterated on the card glow/opacity problem 6 times instead of diagnosing it on turn 1. The root cause was always "backgrounds behind cards differ; translucent surfaces tint." I kept moving gradient positions and alpha values instead of just saying that out loud and asking "do you want the cards opaque or not?"

---

## Detailed findings

### 1. `ReleaseSpotlight` description never renders — BUG

[`src/components/ReleaseSpotlight.tsx:131`](src/components/ReleaseSpotlight.tsx):

```tsx
{release.description && typeof release.description === "string" && (
  <p ...>{release.description}</p>
)}
```

The `description` field on the Sanity release schema is `blockContent` (Portable Text array), never a string. This check always evaluates false, so the description never appears under the Latest Release title on the homepage. Fix: use `@portabletext/react` to render block content, or switch the field to plain text.

### 2. Translucent surface tokens not applied everywhere — CONSISTENCY BUG

[`src/components/LeadGen.tsx:116`](src/components/LeadGen.tsx):

```tsx
background: "var(--color-bg-raised)",  // <-- should be var(--card-bg-raised)
```

[`src/components/ReleaseSpotlight.tsx:146`](src/components/ReleaseSpotlight.tsx):

```tsx
background: "var(--color-bg-surface)",  // <-- should be var(--card-bg)
```

I built a translucency system around `--card-bg` / `--card-bg-raised`, then forgot to use those tokens in the very first components I'd written. That's why the LeadGen inner "YOUR EMAIL" panel is fully solid while the outer card is 94%.

### 3. `<picture aria-hidden>` is invalid — A11Y

[`src/components/WordmarkHero.tsx:55`](src/components/WordmarkHero.tsx):

```tsx
<picture aria-hidden="true" className="...">
```

ESLint rule `jsx-a11y/aria-unsupported-elements` fires because `<picture>` is a metadata element that doesn't get a role. Move the `aria-hidden` to the `<img>` inside, or use a `<div>` with `role="img"` if we ever need semantics.

### 4. `any` in new interfaces — TYPE DEBT

[`src/components/ReleaseSpotlight.tsx:18,22`](src/components/ReleaseSpotlight.tsx):

```ts
coverArt?: any;
description?: any;
```

Should import the Sanity-generated types or use `unknown` with narrowing. Two ESLint errors. (The pre-existing `any`s in `lib/types.ts`, `lib/stripe.ts`, `sanity/image.ts` were already there before this session — not my debt, but inherited.)

### 5. Cards over different backgrounds still look subtly different — DESIGN LIMIT

With `--card-bg: rgba(17, 24, 32, 0.94)`, 6% of whatever is behind each card still bleeds through. The LeadGen sits over the hero crowd photo (dark); the homepage Upcoming cards sit over the bg-dc28 silky watermark (lighter). That 6% difference is perceptible.

**Three paths forward (pick one):**

- **A — Fully opaque cards (`0.97` or `1.0`):** Cards look identical regardless of backdrop. Loses the "airy panel floating over photo" effect. Most design-system-consistent.
- **B — Keep translucent, put same background behind all cards:** Wrap all card-containing sections in a `<section>` with a shared dark-photo or dark-gradient background. Cards then bleed the same thing through.
- **C — Replace the bleed with `backdrop-filter: brightness(0.3)`:** Darken whatever is actually behind each card so it reads nearly black. Consistent regardless of backdrop. Performance cost (compositor layer per card), and backdrop-filter support in older browsers is weak.

My pick: **A**. It matches what the Claude Design exports actually shipped (solid cards with gradient blooms on top of the surface, not translucent).

### 6. `NewsMarquee` has stale hardcoded items

[`src/components/NewsMarquee.tsx:7-14`](src/components/NewsMarquee.tsx):

```ts
const DEFAULT_ITEMS = [
  "DCR#22 BALLERINA",
  "MAY 8 — LYNY LIVE",
  "DAISY CHAIN #28",
  "SPIN NIGHTCLUB · SD",
  "NEW MERCH",
  "DAISY CHAIN MAIL",
];
```

When DCR#22 drops or DC#28 passes, these strings are lies. Either:
- Add a `dispatch[]` string array to `homepageSettings` in Sanity Studio so you can edit from the CMS, or
- Auto-generate from the newest release + next upcoming event + static "DAISY CHAIN MAIL" token.

### 7. Dead CSS utilities

In [`src/app/globals.css`](src/app/globals.css):

- `@keyframes dcWave` — defined line 540, never used.
- `@keyframes grainShift` — defined line 546, never used (I removed the animation from `body::before` when I fixed the perf issue, but kept the keyframe).
- `.text-chrome` — the chrome-flyer gradient text. Nobody uses it. If you want flyer-style type anywhere, this is available.
- `.text-body`, `.text-caption`, `.text-micro`, `.text-mono` — typography presets I installed from the DS. Nothing in the codebase references them; everything uses inline styles or Tailwind arbitrary values instead.
- `.grain` — opt-in grain surface. Nobody uses it.
- `.btn-ghost` — one usage (`ReleaseSpotlight`'s Buy Digital button). Could remove if unused.
- `.zone-abyss`, `.zone-deep` — already flagged as deprecated in CLAUDE.md. `Footer` still uses `zone-abyss` on its root. Should swap to the translucent card system for consistency.

**Size impact:** maybe 1-2 KB in the shipped CSS. Not huge. But it makes future agents think these utilities are "available primitives" when they're actually architectural vestiges.

### 8. Inline styles everywhere

Count of `style={{` in the files I created/touched this session:

```
WordmarkHero.tsx        10 inline styles
LeadGen.tsx              18 inline styles
NewsMarquee.tsx          14 inline styles
ReleaseSpotlight.tsx     17 inline styles
ShopStrip.tsx             9 inline styles
SectionHeader.tsx         4 inline styles
CatalogGrid.tsx (rewrite) 8 inline styles
events/page.tsx (PastShowsList)  8 inline styles
artists/page.tsx (ArtistCard)    9 inline styles
shop/page.tsx (ProductCard)     10 inline styles
about/page.tsx                   9 inline styles
```

~120 inline style declarations across the new code. Every time you want to tweak a padding or font-size, it's a hunt-and-peck. These should mostly be Tailwind arbitrary values (`style={{fontSize: 14}}` → `className="text-[14px]"`), or — for values that repeat — named design tokens in `@theme`.

Why this happened: I ported the Claude Design JSX exports which use `style={{ ... }}` because they're plain HTML prototypes. I kept that convention instead of translating to Tailwind. Should have translated.

### 9. Shared layout primitive missing

These three property sets appear verbatim across at least 6 files:

```ts
className="max-w-[1440px] mx-auto"
style={{ padding: "72px clamp(24px, 4vw, 48px)" }}
```

Should be a `<PageSection>` component or a `.section` class. Right now, changing the site's content padding requires 10 finds-and-replaces.

### 10. Component over-indentation in `WordmarkHero`

[`src/components/WordmarkHero.tsx:76-127`](src/components/WordmarkHero.tsx):

```tsx
<div className="relative z-10">

{/* Top kicker row */}
<div className="flex justify-between ...">
```

The inner `<div className="relative z-10">` wrapper is not indented relative to its children. Cosmetic but sloppy — suggests I added it as a late change and didn't clean up. Children should be indented under it.

### 11. Perf patches are good but introduced complexity

- `WordmarkHero` uses `useRef` + `requestAnimationFrame` to write letter-spacing directly to the DOM instead of setState. Good. This is correct modern React perf.
- `body::before` no longer animates (`grainShift` keyframe unused) and no longer blends. Good.
- `NewsMarquee` uses `content-visibility: auto`. Good.
- `ShopStrip` and `src/app/shop/page.tsx` use `shopifyImg(url, 480)` to request a sized image from Shopify's CDN. Good.

But the `grainShift` keyframe still exists in CSS, unused. Minor.

### 12. `/about` page static contact emails

[`src/app/about/page.tsx:22-27`](src/app/about/page.tsx):

```ts
const CONTACTS: { label: string; email: string }[] = [
  { label: "Demos", email: "demos@daisychainsd.com" },
  ...
];
```

Hardcoded. If emails change, edit the file. Could live in a simple `aboutSettings` Sanity singleton, but low priority.

### 13. Sanity schema fields added but no backfill

I added these optional fields in the session:

- `release.links` (Spotify/Apple Music/Bandcamp/SoundCloud/YouTube) — zero releases have it populated.
- `event.recapUrl` — zero events have it populated.
- `artist.role` — zero artists have it populated.
- `artist.hometown` — zero artists have it populated.

The UI renders fine with empty values, but these cards will look visually lean until someone sits in Sanity Studio and fills them out. This is expected work-to-do, not a bug, just flagging.

### 14. `ReleaseSpotlight` CTA labels could be wrong

[`src/components/ReleaseSpotlight.tsx:191`](src/components/ReleaseSpotlight.tsx):

```tsx
Listen — {trackCount || ""} {trackCount === 1 ? "track" : "tracks"}
```

If `trackCount` is 0 (e.g. an unpopulated release), the label reads "Listen —  tracks" with a weird double-space. Defensive fallback needed.

Also: the button says "Listen" but it actually links to `/releases/${slug}` — it opens the release page, not a player. Either relabel ("Open Release" / "View") or wire it to actually trigger playback.

### 15. Hydration mismatch warning (benign, flag anyway)

The Next.js dev overlay shows "1 Issue" on the homepage. React's hydration-mismatch warning fires because Cursor's browser MCP injects `data-cursor-ref` attributes into the DOM before React hydrates. **This is not a bug in our code** — it only happens in the Cursor browser pane, not in real browsers. React's error message itself flags "browser extension" as the most likely cause.

In production (Chrome/Safari/Firefox without Cursor's tools), no hydration warning will fire.

### 16. Cleanup that actually happened (keep for reference)

✓ Deleted `src/components/HeroSlideshow.tsx` (confirmed unused).
✓ Deleted `public/hero.png`, `public/hero-horizontal.png`, `public/hero-vertical.png`, `public/flower-blue.png`, `public/dc28-flyer-landscape.png` — all removed when the wordmark hero replaced the photo hero.
✓ Added `design-system/` folder at project root with the full Claude Design asset bundle.
✓ Pointer added to `CLAUDE.md` under "Design References".

---

## Recommended next session

In priority order:

1. **Decide on card opacity — opaque or translucent.** Pick A/B/C from §5, implement, move on. Stop iterating.
2. **Fix the bugs (§1–§4).** ~30 min. Description rendering, `--card-bg-raised` wiring, aria-hidden, `any` types.
3. **Kill dead CSS (§7).** ~15 min. Delete unused keyframes and utility classes.
4. **Extract shared layout primitives (§9).** `<PageSection>` component. Every new page gets it. ~30 min.
5. **Translate inline styles → Tailwind (§8).** Longer effort, do incrementally as you touch each component.
6. **Wire `NewsMarquee` to Sanity (§6).** Add `homepageSettings.dispatch[]` string array.
7. **Consider a separate schema for the About page content** so emails aren't hardcoded.

## What I did well

- Build passes cleanly every phase.
- TypeScript clean (aside from pre-existing `any`s).
- Preserved Sanity/Supabase/Stripe/Shopify/Beehiiv integrations throughout.
- Didn't break a single existing page or flow.
- Font system is cohesive (Archivo Black for labels/headings, Rubik Mono One for wordmark + marquee, Azo for body).
- Performance wins: grain overlay no longer hammers the GPU, scroll no longer re-renders React, marquee pauses offscreen, images lazy-load at correct sizes.

## What I did badly

- Six rounds of iteration on the card opacity problem instead of diagnosing and asking.
- Shipped inline styles everywhere instead of translating to Tailwind.
- Introduced utility classes I never actually used anywhere in the codebase.
- Didn't catch the broken description render in `ReleaseSpotlight`.
- Forgot to use my own tokens (`--card-bg-raised`) in `LeadGen` inner panel.
- Didn't run ESLint until the audit — would have caught the `any` and aria-hidden issues earlier.

---

_Audit written 2026-04-22 end of session. Nothing in this report has been auto-fixed — deliberate, because the user asked me to stop._
