<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Daisy Chain Brand & Design System

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
