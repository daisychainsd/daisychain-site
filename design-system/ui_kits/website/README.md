# Daisy Chain — Website UI Kit

Faithful recreation of [daisychainsd.com](https://daisychainsd.com), the production Next.js site at `github.com/daisychainsd/daisychain-site`.

## Files
- `index.html` — click-thru prototype: homepage → release detail → events
- `Header.jsx`, `Footer.jsx` — site chrome
- `ReleaseCard.jsx`, `CatalogGrid.jsx` — catalog
- `UpcomingEventCard.jsx` — shared events hero
- `TrackList.jsx` — wavesurfer-style player (faked waveform)
- `FormatToggle.jsx` — digital/physical pill
- `NewsletterSignup.jsx` — beehiiv signup
- `data.js` — real catalog entries from `CATALOG.md` + mock events

All components reference `../../colors_and_type.css` tokens.

## Merch pricing and placement

Use the production `MerchPrice` component for crossed-out original prices, clear current prices and red percentage badges. Ops owns regular/effective prices and discounts; Sanity owns selected products and their order. See [current implementation](../../../MERCH-DISCOUNTS-AND-PLACEMENT-2026-09-30.md). Existing token colors and asymmetric radii apply.
