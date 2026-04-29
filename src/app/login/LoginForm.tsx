"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/account";

  // Buy-flow context: when ReleaseInteractive bounces a logged-out user here,
  // it passes slug/title/artist/price/releaseId. Presence of `slug` is the
  // signal to show the value-prop banner + guest-checkout option.
  const buySlug = searchParams.get("slug");
  const buyTitle = searchParams.get("title");
  const buyArtist = searchParams.get("artist");
  const buyReleaseId = searchParams.get("releaseId");
  const buyPriceRaw = searchParams.get("price");
  const buyPrice = buyPriceRaw ? Number(buyPriceRaw) : null;
  const isBuyFlow = Boolean(buySlug);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  // Preserve buy context when navigating to /signup so the same banner
  // shows there too.
  const signupHref = (() => {
    const qp = new URLSearchParams();
    if (redirect !== "/account") qp.set("redirect", redirect);
    if (buySlug) qp.set("slug", buySlug);
    if (buyTitle) qp.set("title", buyTitle);
    if (buyArtist) qp.set("artist", buyArtist);
    if (buyReleaseId) qp.set("releaseId", buyReleaseId);
    if (buyPriceRaw) qp.set("price", buyPriceRaw);
    const q = qp.toString();
    return `/signup${q ? `?${q}` : ""}`;
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    if (!supabase) {
      setError("Auth is not configured yet. Add Supabase credentials to .env.local");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  }

  // Guest checkout: skip account creation, hit /api/checkout with guestEmail.
  // Stripe success_url goes to /download/<slug>?session_id=... so the buyer
  // gets their files without ever seeing a login screen.
  async function handleGuestCheckout() {
    if (!buySlug) return;
    if (!email.trim()) {
      setError("Enter the email address for your receipt, then try again.");
      return;
    }
    setError(null);
    setGuestLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestCheckout: true,
          guestEmail: email.trim(),
          releaseId: buyReleaseId || undefined,
          title: buyTitle || "Digital Download",
          artist: buyArtist || "Daisy Chain",
          price: buyPrice ?? 0,
          slug: buySlug,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(data.error || "Couldn't start checkout");
        setGuestLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong");
      setGuestLoading(false);
    }
  }

  return (
    <section className="min-h-[60vh] flex items-center justify-center py-20">
      <div className="w-full max-w-md px-6">
        <div className="container-organic p-8 sm:p-10">
          <div className="mb-6">
            <h1 className="text-headline">Log In</h1>
          </div>

          {isBuyFlow && (
            <ValueProp title={buyTitle} price={buyPrice} />
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm text-text-secondary mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-bg-raised border border-blue-300/10 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-blue-300/30 focus:ring-1 focus:ring-blue-300/20 transition-colors"
                placeholder="you@email.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm text-text-secondary mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                minLength={6}
                className="w-full px-4 py-3 bg-bg-raised border border-blue-300/10 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-blue-300/30 focus:ring-1 focus:ring-blue-300/20 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p id="form-error" className="text-red-400 text-sm" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || guestLoading}
              className="w-full container-pill-r py-3 bg-blue-300 text-bg-deep font-medium text-sm hover:bg-blue-200 hover:shadow-[0_0_20px_rgba(124,185,232,0.15)] transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {isBuyFlow && (
            <div className="mt-6 pt-6 border-t border-blue-300/20 space-y-3">
              <p className="text-center text-sm font-medium text-text-primary">
                Prefer not to sign in?
              </p>
              <button
                type="button"
                onClick={handleGuestCheckout}
                disabled={guestLoading || loading}
                className="w-full container-pill-r py-3 border-2 border-blue-300/50 bg-blue-300/10 text-blue-200 font-semibold text-sm hover:bg-blue-300/20 hover:border-blue-300/70 hover:shadow-[0_0_24px_rgba(124,185,232,0.12)] transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {guestLoading ? "Redirecting to secure checkout…" : "Buy as guest — same price"}
              </button>
              <p className="text-center text-xs text-text-secondary leading-snug">
                One-time download link to this email. No account required.
              </p>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-text-secondary">
            Don&apos;t have an account?{" "}
            <Link href={signupHref} className="text-blue-300 hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

function ValueProp({ title, price }: { title: string | null; price: number | null }) {
  const priceLabel = price && price > 0 ? `$${price.toFixed(2)}` : null;
  return (
    <div
      className="mb-6 p-4 rounded-lg"
      style={{
        background: "rgba(124,185,232,0.05)",
        border: "1px solid rgba(124,185,232,0.18)",
      }}
    >
      <div
        className="uppercase mb-2"
        style={{
          fontFamily: "var(--font-heading), system-ui, sans-serif",
          fontWeight: 900,
          fontSize: 10,
          letterSpacing: "0.14em",
          color: "var(--color-blue-300)",
        }}
      >
        Buying {title || "a release"}
        {priceLabel ? ` · ${priceLabel}` : ""}
      </div>
      <p className="text-text-primary text-sm font-medium mb-2">
        An account is free and keeps it all in one place.
      </p>
      <ul className="text-text-secondary text-xs leading-relaxed space-y-1 list-none p-0 m-0">
        <li>· Re-download anything you&apos;ve bought, anytime</li>
        <li>· Keep track of every release you own</li>
        <li>· Option to grab the unlimited pass — every past + future drop, one price</li>
      </ul>
    </div>
  );
}
