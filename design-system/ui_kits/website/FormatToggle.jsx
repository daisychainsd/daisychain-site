function FormatToggle({ formats, active, onChange, size = "default" }) {
  if (!formats || formats.length <= 1) return null;
  const padding = size === "compact" ? "2px 12px" : "6px 20px";
  const fontSize = size === "compact" ? 10 : 12;

  return (
    <div style={toggleStyles.toggle}>
      {formats.map((f, i) => {
        const isActive = active === f;
        const pos = i === 0 ? "first" : i === formats.length - 1 ? "last" : "mid";
        const activeRadius = pos === "first" ? "var(--radius-pill-left)"
                           : pos === "last" ? "var(--radius-pill-right)" : 4;
        return (
          <button key={f}
                  onClick={() => onChange?.(f)}
                  style={{
                    ...toggleStyles.option,
                    padding,
                    fontSize,
                    ...(isActive ? { ...toggleStyles.active, borderRadius: activeRadius } : {}),
                  }}>
            {formatLabel(f)}
          </button>
        );
      })}
    </div>
  );
}

function formatLabel(f) {
  const l = f.toLowerCase();
  if (["vinyl", "cd", "cassette", "physical"].includes(l)) return "Physical";
  return f[0].toUpperCase() + f.slice(1);
}

const toggleStyles = {
  toggle: {
    display: "inline-flex", padding: 3, borderRadius: 24,
    background: "var(--color-bg-raised)",
    border: "1px solid rgba(255,255,255,0.08)",
    position: "relative",
  },
  option: {
    position: "relative", zIndex: 1, cursor: "pointer",
    fontFamily: "var(--font-label)", textTransform: "uppercase",
    letterSpacing: "0.05em", color: "var(--fg3)",
    background: "transparent", border: "none",
    transition: "color .25s, background-color .25s, border-color .25s",
  },
  active: {
    color: "var(--color-blue-300)", background: "var(--color-bg-shelf)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
};

window.FormatToggle = FormatToggle;
