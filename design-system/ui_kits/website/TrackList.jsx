function TrackList({ tracks, releaseArtist }) {
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);

  function handlePlay(i) {
    if (activeIdx === i) { setIsPlaying((p) => !p); return; }
    setActiveIdx(i); setIsPlaying(true);
  }

  return (
    <div style={tlStyles.list}>
      {tracks.map((track, i) => {
        const isActive = activeIdx === i;
        const showPause = isActive && isPlaying;
        return (
          <div key={i}
               style={{
                 ...tlStyles.row,
                 ...(isActive ? tlStyles.rowActive : {}),
               }}>
            <button onClick={() => handlePlay(i)} style={{ ...tlStyles.play, ...(isActive ? tlStyles.playActive : {}) }}>
              {showPause ? (
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3" y="2" width="4" height="12" rx="1"/>
                  <rect x="9" y="2" width="4" height="12" rx="1"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 2l10 6-10 6V2z"/>
                </svg>
              )}
            </button>

            {isActive ? (
              <div style={tlStyles.activeBody}>
                <div style={tlStyles.activeMeta}>
                  <p style={{ ...tlStyles.title, color: "var(--color-blue-300)" }}>{track.t}</p>
                  <p style={tlStyles.artist}>{track.a || releaseArtist}</p>
                </div>
                <Waveform progress={showPause ? 0.38 : 0.15} />
              </div>
            ) : (
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={tlStyles.title}>{track.t}</p>
                <p style={tlStyles.artist}>{track.a || releaseArtist}</p>
              </div>
            )}

            <span style={tlStyles.duration}>{track.d}</span>
          </div>
        );
      })}
    </div>
  );
}

function Waveform({ progress = 0.3 }) {
  const heights = [4,6,8,11,14,18,22,20,16,12,10,14,20,26,30,24,18,14,10,12,16,22,28,26,20,16,14,18,22,26,22,18,14,10,14,18,22,20,16,12,8,6,10,14,18,14,10,8,6,4,3,2];
  return (
    <div style={tlStyles.wave}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width: 2, height: h, borderRadius: 1,
          background: i / heights.length < progress ? "var(--color-blue-300)" : "#1F2A3A",
        }} />
      ))}
    </div>
  );
}

const tlStyles = {
  list: {
    borderRadius: "var(--radius-scoop)",
    background: "var(--color-bg-surface)",
    border: "1px solid var(--border)",
    overflow: "hidden",
  },
  row: {
    display: "flex", alignItems: "center", gap: 16,
    padding: "14px 18px",
    borderBottom: "1px solid rgba(124,185,232,0.05)",
    borderLeft: "2px solid transparent",
    transition: "background-color .2s, border-color .2s",
  },
  rowActive: {
    background: "rgba(124,185,232,0.05)",
    borderLeftColor: "var(--color-blue-300)",
  },
  play: {
    width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
    color: "var(--fg2)", background: "transparent", border: "none", cursor: "pointer",
    flex: "none", transition: "color .2s",
  },
  playActive: { color: "var(--color-blue-300)" },
  title: { fontSize: 16, color: "var(--fg1)", fontWeight: 500, margin: 0, fontFamily: "var(--font-body)",
           whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  artist: { fontSize: 14, color: "var(--fg2)", margin: 0 },
  duration: {
    fontSize: 14, color: "var(--fg3)", fontFamily: "var(--font-label)",
    flex: "none",
  },
  activeBody: { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 16 },
  activeMeta: { flex: "none", maxWidth: "45%", minWidth: 0 },
  wave: { flex: 1, minWidth: 0, height: 40, display: "flex", alignItems: "center", gap: 1.5 },
};

window.TrackList = TrackList;
