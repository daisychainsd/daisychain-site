const { useState } = React;

function Header({ cartCount, onNav, current }) {
  const nav = ["Music", "Artists", "Shop", "Events", "Account"];
  return (
    <header style={dcStyles.header}>
      <nav style={dcStyles.headerNav}>
        <a onClick={() => onNav("home")} style={dcStyles.logoLink} aria-label="Home">
          <img src="../../assets/flower-white.png" alt="" style={{ width: 32, height: 32 }} />
        </a>
        <div style={dcStyles.headerLinks}>
          {nav.map((n) => (
            <a key={n}
               onClick={() => onNav(n === "Events" ? "event" : n === "Music" ? "home" : "home")}
               style={{ ...dcStyles.navLink, ...(current === n.toLowerCase() ? dcStyles.navLinkActive : {}) }}>
              {n}
            </a>
          ))}
          <div style={dcStyles.cart}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2l2 4h8l2-4M4 6h16l-1.5 12H5.5L4 6z" />
            </svg>
            {cartCount > 0 && <div style={dcStyles.cartBadge}>{cartCount}</div>}
          </div>
        </div>
      </nav>
    </header>
  );
}

const dcStyles = {
  header: {
    position: "fixed", inset: "0 0 auto 0", zIndex: 50,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "var(--color-bg-deep)",
  },
  headerNav: {
    maxWidth: 1280, margin: "0 auto",
    padding: "12px 24px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  logoLink: { display: "flex", alignItems: "center", padding: 6, borderRadius: 8, cursor: "pointer" },
  headerLinks: { display: "flex", alignItems: "center", gap: 4 },
  navLink: {
    padding: "8px 14px", borderRadius: 8, color: "var(--fg2)",
    fontSize: 14, cursor: "pointer", transition: "color .2s, background-color .2s",
    textDecoration: "none",
  },
  navLinkActive: { color: "var(--color-blue-300)", background: "rgba(124,185,232,0.06)" },
  cart: {
    position: "relative", width: 36, height: 36, display: "flex",
    alignItems: "center", justifyContent: "center", color: "var(--fg2)",
    cursor: "pointer", marginLeft: 4,
  },
  cartBadge: {
    position: "absolute", top: -2, right: -2, width: 16, height: 16,
    borderRadius: "50%", background: "var(--color-blue-300)",
    color: "var(--color-bg-deep)", fontSize: 10, fontWeight: 700,
    fontFamily: "var(--font-mono)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
};

window.Header = Header;
window.dcHeaderStyles = dcStyles;
