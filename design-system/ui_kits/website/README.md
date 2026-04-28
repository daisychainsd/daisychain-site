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
