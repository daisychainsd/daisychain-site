function ReleaseCard({ release, onClick }) {
  const isUpcoming = release.status === "upcoming";
  const title = release.title.replace(/\s+(EP|Album)$/i, "");
  return (
    <a onClick={onClick} style={cardStyles.root}>
      <div style={cardStyles.inner}>
        <div style={cardStyles.art}>
          <div style={{ ...cardStyles.artFill, background: release.cover }} />
          <span style={cardStyles.catalogPill}>{release.catalog}</span>
          {isUpcoming && <span style={cardStyles.soonBadge}>Soon</span>}
        </div>
        <div style={cardStyles.meta}>
          <p style={cardStyles.title}>{title}</p>
          <p style={cardStyles.artist}>{release.artist}</p>
        </div>
      </div>
    </a>
  );
}

const cardStyles = {
  root: { display: "block", cursor: "pointer", textDecoration: "none" },
  inner: {
    borderRadius: "var(--radius-organic-md)",
    background: "var(--color-bg-surface)",
    border: "1px solid var(--border)",
    padding: 8,
    transition: "transform .25s var(--ease-daisy), box-shadow .25s var(--ease-daisy)",
  },
  art: {
    position: "relative",
    borderRadius: "var(--radius-organic-inv-md)",
    aspectRatio: "1",
    overflow: "hidden",
    background: "var(--color-bg-raised)",
    border: "1px solid rgba(255,255,255,0.04)",
  },
  artFill: { position: "absolute", inset: 0 },
  catalogPill: {
    position: "absolute", bottom: 8, left: 8,
    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
    color: "rgba(255,255,255,0.8)", padding: "2px 8px",
    borderRadius: 999, fontFamily: "var(--font-mono)", fontSize: 10,
  },
  soonBadge: {
    position: "absolute", top: 8, right: 8,
    background: "rgba(124,185,232,0.2)", border: "1px solid rgba(124,185,232,0.3)",
    color: "var(--color-blue-300)", padding: "2px 8px",
    borderRadius: 999, fontFamily: "var(--font-heading)",
    fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
    backdropFilter: "blur(4px)",
  },
  meta: { padding: "12px 12px 10px" },
  title: { color: "var(--fg1)", fontWeight: 600, fontSize: 15, margin: 0, fontFamily: "var(--font-body)" },
  artist: { color: "var(--fg2)", fontSize: 13, margin: "2px 0 0" },
};

function CatalogGrid({ releases, onSelect }) {
  return (
    <div style={gridStyles.grid}>
      {releases.map((r) => (
        <ReleaseCard key={r.slug} release={r} onClick={() => onSelect(r)} />
      ))}
    </div>
  );
}

const gridStyles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 20,
  },
};

window.ReleaseCard = ReleaseCard;
window.CatalogGrid = CatalogGrid;
