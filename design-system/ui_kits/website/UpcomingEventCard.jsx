function UpcomingEventCard({ event, onTickets }) {
  return (
    <div style={eventStyles.card}>
      <div style={eventStyles.inner}>
        <div style={eventStyles.flyer}>
          <img src={event.flyer} alt="" style={eventStyles.flyerImg} />
        </div>
        <div style={eventStyles.right}>
          <div>
            <div style={eventStyles.top}>
              <span style={eventStyles.upcoming}>Upcoming</span>
              <span style={eventStyles.dow}>{event.dow}</span>
            </div>
            <div style={eventStyles.date}>{event.dateShort}</div>
            <div style={eventStyles.year}>{event.year}</div>
            <h2 style={eventStyles.title}>{event.title}</h2>
            <p style={eventStyles.venue}>{event.venue}</p>
          </div>
          <div>
            {event.lineup?.length > 0 && (
              <div style={eventStyles.lineup}>
                <div style={eventStyles.lineupLabel}>Lineup</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {event.lineup.map((a) => (
                    <span key={a.name} style={a.slug ? eventStyles.lineupLink : eventStyles.lineupName}>
                      {a.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <button onClick={onTickets} style={eventStyles.cta}>
              Get Tickets
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10m0 0l-4-4m4 4l-4 4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const eventStyles = {
  card: {
    borderRadius: "var(--radius-organic-lg)",
    background: "var(--color-bg-surface)",
    border: "1px solid var(--border)",
    padding: 16,
  },
  inner: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 1fr) 1.2fr",
    gap: 32,
  },
  flyer: {
    borderRadius: "var(--radius-organic-inv)",
    aspectRatio: "4/5",
    overflow: "hidden",
    background: "var(--color-bg-raised)",
    border: "1px solid rgba(255,255,255,0.04)",
  },
  flyerImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  right: { padding: "16px 12px 8px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 24 },
  top: { display: "flex", alignItems: "center", gap: 12, marginBottom: 24 },
  upcoming: {
    padding: "6px 16px", borderRadius: "var(--radius-pill-left)",
    fontFamily: "var(--font-heading)", fontSize: 12, letterSpacing: "0.08em",
    textTransform: "uppercase", color: "var(--color-blue-300)",
    border: "1px solid rgba(124,185,232,0.2)", background: "rgba(124,185,232,0.05)",
  },
  dow: {
    fontFamily: "var(--font-heading)", fontSize: 12,
    color: "var(--fg3)", letterSpacing: "0.06em", textTransform: "uppercase",
  },
  date: {
    fontFamily: "var(--font-mono)", color: "var(--color-blue-300)",
    fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700,
    letterSpacing: "-0.02em", lineHeight: 1,
  },
  year: {
    color: "var(--fg3)", fontFamily: "var(--font-heading)",
    fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 6,
  },
  title: {
    fontFamily: "var(--font-heading)", fontWeight: 900,
    fontSize: "clamp(28px, 3.5vw, 44px)",
    textTransform: "uppercase", letterSpacing: "-0.02em",
    lineHeight: 1.1, margin: "24px 0 6px",
  },
  venue: { color: "var(--fg2)", fontSize: 15, margin: 0 },
  lineup: {
    marginBottom: 24, paddingTop: 24,
    borderTop: "1px solid rgba(124,185,232,0.1)",
  },
  lineupLabel: {
    fontFamily: "var(--font-heading)", fontSize: 12,
    color: "var(--fg3)", letterSpacing: "0.06em",
    textTransform: "uppercase", fontWeight: 700, marginBottom: 12,
  },
  lineupName: { color: "var(--fg1)", fontSize: 20, fontFamily: "var(--font-heading)", fontWeight: 900 },
  lineupLink: { color: "var(--color-blue-300)", fontSize: 20, fontFamily: "var(--font-heading)", fontWeight: 900, cursor: "pointer" },
  cta: {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "14px 24px", border: "none",
    borderRadius: "var(--radius-pill-right)",
    background: "var(--color-blue-300)", color: "var(--color-bg-deep)",
    fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16,
    cursor: "pointer", transition: "background-color .2s, box-shadow .2s",
  },
};

window.UpcomingEventCard = UpcomingEventCard;
