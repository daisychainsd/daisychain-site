function NewsletterSignup() {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState("idle");

  function submit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("loading");
    setTimeout(() => setState("success"), 700);
  }

  return (
    <section style={nlStyles.section}>
      <div style={nlStyles.inner}>
        {state === "success" ? (
          <div style={{ padding: "16px 0", textAlign: "center" }}>
            <p style={nlStyles.successT}>You're in!</p>
            <p style={nlStyles.successS}>We'll keep you posted on events, music, and more.</p>
          </div>
        ) : (
          <>
            <p style={nlStyles.copy}>Stay up to date with events, music, and more</p>
            <form onSubmit={submit} style={nlStyles.form}>
              <input type="email" required value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     placeholder="your@email.com"
                     style={nlStyles.input} />
              <button type="submit" disabled={state === "loading"} style={nlStyles.btn}>
                {state === "loading" ? "Signing up..." : "Subscribe"}
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

const nlStyles = {
  section: { padding: "56px 24px" },
  inner: { maxWidth: 640, margin: "0 auto", textAlign: "center" },
  copy: { color: "var(--fg2)", fontSize: 17, margin: "0 0 22px" },
  form: { display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" },
  input: {
    padding: "12px 18px", borderRadius: 999,
    background: "var(--color-bg-elevated)",
    border: "1px solid rgba(124,185,232,0.1)",
    color: "var(--fg1)", fontSize: 14, minWidth: 280,
    fontFamily: "inherit", outline: "none",
  },
  btn: {
    padding: "12px 26px", borderRadius: 999, border: "none",
    background: "var(--color-blue-300)", color: "var(--color-bg-deep)",
    fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 14,
    cursor: "pointer",
  },
  successT: { color: "var(--color-blue-300)", fontWeight: 700, fontSize: 20, margin: 0, fontFamily: "var(--font-heading)" },
  successS: { color: "var(--fg2)", fontSize: 14, margin: "6px 0 0" },
};

window.NewsletterSignup = NewsletterSignup;
