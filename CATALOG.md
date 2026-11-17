# Daisy Chain Recordings — Canonical Music Catalog

> This file is the single source of truth for all release and artist data.
> Any seed script or data migration must match this exactly.

This document covers the music seed catalog. Physical products, variant SKUs, prices, stock and product photos are managed in [Merch Ops](https://www.daisychainsd.com/ops/merch), backed by Supabase since September 29, 2026. See the [merch workflow](MERCH-ROLLOUT.md) and [opening-stock record](MERCH-PRODUCT-EDITOR-2026-09-29.md); this file is not a merch inventory source. Ops also owns discounts; Sanity controls Homepage and Shop product placement through stable IDs. See [MERCH-DISCOUNTS-AND-PLACEMENT-2026-09-30.md](MERCH-DISCOUNTS-AND-PLACEMENT-2026-09-30.md).

## Artists (20)

| Artist | Notes |
|---|---|
| Player Dave | Label head |
| Mirror Maze | |
| Canary Yellow | |
| Crosstalk | |
| JOIA | |
| Kelbin | |
| Next To Blue | |
| Belay | JOIA & Monotrope collab project |
| Coido | Remixer |
| sumthin sumthin | Featured artist |
| Elohim | Featured artist |
| Niles | Featured artist |
| Lilah | |
| QRTR | |
| Stresshead | |
| RamonPang | No space |
| Levos | |
| Peter Sheppard | Featured artist |
| Allegra Miles | Featured artist |
| Monotrope | Part of Belay |

## Remix Rule (R catalog numbers)

For any DCR[X]R release:
- **Artist ref** = same as DCR[X] (the original release artist)
- **Display artist** = the remixer (shown on cards so it doesn't look like a duplicate)
- **Track title** = "Original Title (Remixer Name Remix)"

## Releases (14)

### DCR1 — single — "Hush"
- **Artist ref:** Player Dave
- **Display artist:** Player Dave & sumthin sumthin
- Tracks:
  1. Hush — trackArtist: Player Dave & sumthin sumthin

### DCR2 — single — "Daydream"
- **Artist ref:** Mirror Maze
- Tracks:
  1. Daydream

### DCR2R — remix — "Daydream Remix"
- **Artist ref:** Mirror Maze (from DCR2)
- **Display artist:** Player Dave (remixer)
- Tracks:
  1. Daydream (Player Dave Remix)

### DCR5 — single — "You Were The One"
- **Artist ref:** Canary Yellow
- Tracks:
  1. You Were The One

### DCR7 — ep — "and then i started floating EP"
- **Artist ref:** Player Dave
- Pre-release singles: DCR3, DCR4, DCR6
- Tracks:
  1. Dream Logic
  2. goin under
  3. No One Can See — trackArtist: Player Dave & Next To Blue
  4. Confetti

### DCR10 — ep — "2Kids EP"
- **Artist ref:** JOIA
- Pre-release singles: DCR8, DCR9
- Tracks:
  1. Badboi — trackArtist: Player Dave & JOIA
  2. 2Kids
  3. Trust Me
  4. Close — trackArtist: JOIA & Peter Sheppard
  5. Grit(outro)

### DCR12 — ep — "URL;;irl EP"
- **Artist ref:** Crosstalk
- Pre-release single: DCR11
- Tracks:
  1. INTHA
  2. Cabin
  3. Don't Call — trackArtist: Crosstalk & georgeluqas
  4. Know It — trackArtist: Crosstalk & vondr

### DCR14 — single — "Only One"
- **Artist ref:** Next To Blue
- Tracks:
  1. Only One

### DCR16 — single — "Vital Loop"
- **Artist ref:** Kelbin
- Tracks:
  1. Vital Loop

### DCR18 — single — "Cocky"
- **Artist ref:** Mirror Maze
- **Display artist:** Mirror Maze & Niles
- Tracks:
  1. Cocky

### DCR18R — remix — "Cocky Remix"
- **Artist ref:** Mirror Maze (from DCR18)
- **Display artist:** Coido (remixer)
- Tracks:
  1. Cocky (Coido Remix)

### DCR19 — ep — "Heartbeat EP"
- **Artist ref:** Player Dave
- Pre-release singles: DCR13, DCR15, DCR17
- Tracks:
  1. Heartbeat — trackArtist: Player Dave & Elohim
  2. v@por
  3. Microjoy (feat. Allegra Miles) — trackArtist: Player Dave & Canary Yellow
  4. the way you want me — trackArtist: Player Dave & Elohim

### DCR20 — compilation — "Dream Disc"
- **Artist ref:** Player Dave
- **Display artist:** Various Artists
- Tracks:
  1. Zinc — trackArtist: Lilah
  2. Micro — trackArtist: Kelbin
  3. Prints — trackArtist: Niles
  4. Deeper Permanence — trackArtist: Next To Blue
  5. Patience — trackArtist: Mirror Maze
  6. Upres — trackArtist: QRTR
  7. Overthinking — trackArtist: Stresshead
  8. Task Due — trackArtist: Crosstalk
  9. Stay For Me — trackArtist: JOIA
  10. Awa Funk — trackArtist: RamonPang
  11. Freedom — trackArtist: Levos
  12. Intima (feat. Allegra Miles) — trackArtist: Canary Yellow
  13. What We Dream — trackArtist: Player Dave & JOIA

### DCR21 — ep — "Sakima EP"
- **Artist ref:** Belay
- Tracks:
  1. Sakima
  2. Melted
