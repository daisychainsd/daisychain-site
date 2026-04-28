---
name: daisy-chain-design
description: Use this skill to generate well-branded interfaces and assets for Daisy Chain Records (an independent electronic music label and intimate dance floor in San Diego, CA, run by Player Dave), either for production or throwaway prototypes, mocks, flyers, slides, or social posts. Contains essential design guidelines, colors, type, fonts, brand assets, and a UI kit recreating daisychainsd.com.
user-invocable: true
---

Read the `README.md` file within this skill first — it contains the full brand voice, visual foundations, and iconography guide. Then explore:

- `colors_and_type.css` — the single CSS file to import for all tokens + primitives
- `assets/` — logomarks, hero imagery, flyer reference, fixed background
- `ui_kits/website/` — JSX components that recreate daisychainsd.com (Header, Footer, ReleaseCard, TrackList, UpcomingEventCard, FormatToggle, NewsletterSignup)
- `preview/` — example card treatments

If creating visual artifacts (slides, mocks, throwaway prototypes, social graphics, event flyers), **copy assets out** and create static HTML files for the user to view. The brand lives in:
1. Dark backgrounds (`--color-bg-deep #0A0E14`)
2. Single blue accent (`--color-blue-300 #7CB9E8`)
3. Azo Sans Web Black (Archivo Black fallback) — ALL CAPS, tight tracking
4. Asymmetric organic radii (`24px 8px 24px 4px`)
5. Noise grain overlay (~3% opacity)
6. The daisy logomark (`assets/flower-white.png`)
7. No emoji, no gradients (except chrome-liquid flyer treatments), no filler copy

If working on production code, the Typekit link `https://use.typekit.net/ecz5lqw.css` gives you real Azo Sans Web. The upstream repo is `daisychainsd/daisychain-site` (Next.js 16 + Tailwind v4 + Sanity).

If the user invokes this skill without guidance, ask what they want to build — a new release page, an event flyer, a tour announcement slide, a merch drop, a social post — then ask 3-5 specific questions (audience, content, constraints, variants), and act as an expert designer who outputs HTML artifacts or production code.

**Avoid:** emoji, purple gradients, Inter/Roboto, rounded-corner-with-colored-left-border cards, stock iconography, pure black, pure white, hype language, marketing vapor, "don't miss out" CTAs.

**Favor:** ALL CAPS section headings, asymmetric radii, single blue accent, organic blobs, the flower mark, distressed chrome lettering on flyers, monospace for dates + catalog numbers, hairline dividers at 6% white, the dance floor.
