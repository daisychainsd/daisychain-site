"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/account";

  // Buy-flow context (mirrored from /login). When `slug` is present, the user
  // came from a "Buy Digital" click — we render the value-prop banner and
  // preserve all params on the "Sign in" / guest link back to /login.
  const buySlug = searchParams.get("slug");
  const buyTitle = searchParams.get("title");
  const buyArtist = searchParams.get("artist");
  const buyReleaseId = searchParams.get("releaseId");
  const buyPriceRaw = searchParams.get("price");
  const buyPrice = buyPriceRaw ? Number(buyPriceRaw) : null;
  const isBuyFlow = Boolean(buySlug);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Pass buy context through to /login so guest checkout + the same banner
  // render there too.
  const loginHref = (() => {
    const qp = new URLSearchParams();
    if (redirect !== "/account") qp.set("redirect", redirect);
    if (buySlug) qp.set("slug", buySlug);
    if (buyTitle) qp.set("title", buyTitle);
    if (buyArtist) qp.set("artist", buyArtist);
    if (buyReleaseId) qp.set("releaseId", buyReleaseId);
    if (buyPriceRaw) qp.set("price", buyPriceRaw);
    const q = qp.toString();
    return `/login${q ? `?${q}` : ""}`;
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

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If they gave us a phone number, push it to Laylo (drop CRM / SMS list).
    // Failure here is non-blocking — they're already signed up to the site,
    // we just log and move on. They can be added manually in Laylo if needed.
    if (phone.trim()) {
      try {
        await fetch("/api/laylo-subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: phone.trim(), email }),
        });
      } catch (e) {
        console.error("Laylo subscribe failed (non-blocking):", e);
      }
    }

    router.push(redirect);
    router.refresh();
  }

  return (
    <section className="min-h-[60vh] flex items-center justify-center py-20">
      <div className="w-full max-w-md px-6">
        <div className="container-organic p-8 sm:p-10">
          <div className="mb-6">
            <h1 className="text-headline">Create Account</h1>
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
                autoComplete="new-password"
                minLength={6}
                className="w-full px-4 py-3 bg-bg-raised border border-blue-300/10 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-blue-300/30 focus:ring-1 focus:ring-blue-300/20 transition-colors"
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm text-text-secondary mb-1.5"
              >
                Phone <span className="text-text-muted">(optional — for text drops)</span>
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                inputMode="tel"
                className="w-full px-4 py-3 bg-bg-raised border border-blue-300/10 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-blue-300/30 focus:ring-1 focus:ring-blue-300/20 transition-colors"
                placeholder="+1 555 123 4567"
              />
              <p className="text-xs text-text-muted mt-1.5">
                Get notified the moment new music or shows drop. Standard rates apply. Unsubscribe anytime.
              </p>
            </div>

            {error && (
              <p id="form-error" className="text-red-400 text-sm" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full container-pill-r py-3 bg-blue-300 text-bg-deep font-medium text-sm hover:bg-blue-200 hover:shadow-[0_0_20px_rgba(124,185,232,0.15)] transition-colors disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          {isBuyFlow && (
            <p className="mt-5 pt-5 border-t border-blue-300/10 text-center text-xs text-text-muted">
              <Link href={loginHref} className="text-text-secondary hover:text-blue-300 transition-colors">
                or, just buy as guest →
              </Link>
              <br />
              <span className="text-[11px]">One-time download. No account needed.</span>
            </p>
          )}

          <p className="mt-6 text-center text-sm text-text-secondary">
            Already have an account?{" "}
            <Link href={loginHref} className="text-blue-300 hover:underline">
              Sign in
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
