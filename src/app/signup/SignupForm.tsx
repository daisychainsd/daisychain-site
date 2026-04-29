"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/account";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
          <div className="mb-8">
            <h1 className="text-headline">Create Account</h1>
          </div>

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

          <p className="mt-6 text-center text-sm text-text-secondary">
            Already have an account?{" "}
            <Link
              href={`/login${redirect !== "/account" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
              className="text-blue-300 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
