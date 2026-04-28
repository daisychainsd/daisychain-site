function Footer() {
  const links = ["Instagram", "YouTube", "Bandcamp", "SoundCloud"];
  return (
    <footer style={footerStyles.root}>
      <div style={footerStyles.glow} />
      <div style={footerStyles.inner}>
        <div style={footerStyles.card}>
          <div style={footerStyles.row}>
            <div>
              <div style={footerStyles.brand}>
                <img src="../../assets/flower-white.png" alt="" style={{ width: 20, height: 20, opacity: 0.5 }} />
                <span style={footerStyles.brandName}>DAISY CHAIN</span>
              </div>
              <p style={footerStyles.tag}>
                Independent electronic music label based in San Diego, California.
              </p>
            </div>
            <div style={footerStyles.links}>
              {links.map((l) => (
                <a key={l} style={footerStyles.link}>{l}</a>
              ))}
            </div>
          </div>
          <div style={{ ...footerStyles.glow, margin: "28px 0 18px" }} />
          <p style={footerStyles.copy}>© 2026 Daisy Chain Records. San Diego, CA.</p>
        </div>
      </div>
    </footer>
  );
}

const footerStyles = {
  root: { background: "var(--color-bg-abyss)", marginTop: 80 },
  glow: { height: 1, background: "linear-gradient(90deg,transparent,rgba(124,185,232,0.3),transparent)" },
  inner: { maxWidth: 1280, margin: "0 auto", padding: "64px 24px" },
  card: {
    borderRadius: "var(--radius-organic-lg)",
    background: "var(--color-bg-surface)",
    border: "1px solid var(--border)", padding: 40,
  },
  row: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 32, flexWrap: "wrap" },
  brand: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  brandName: { fontFamily: "var(--font-heading)", fontWeight: 900, letterSpacing: "-0.01em", fontSize: 18 },
  tag: { color: "var(--fg2)", fontSize: 14, maxWidth: 320, margin: 0 },
  links: { display: "flex", gap: 12, flexWrap: "wrap" },
  link: {
    padding: "10px 18px", borderRadius: "var(--radius-pill-left)",
    color: "var(--fg2)", fontSize: 14, cursor: "pointer",
    transition: "color .2s, background-color .2s",
  },
  copy: { color: "var(--fg3)", fontSize: 14, margin: 0 },
};

window.Footer = Footer;
