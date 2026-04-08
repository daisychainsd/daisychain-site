"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/account";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  return (
    <section className="min-h-[60vh] flex items-center justify-center py-20">
      <div className="w-full max-w-md px-6">
        <div className="container-organic p-8 sm:p-10">
          <div className="mb-8">
            <p className="text-label mb-2">Welcome back</p>
            <h1 className="text-headline">Log In</h1>
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
                autoComplete="current-password"
                minLength={6}
                className="w-full px-4 py-3 bg-bg-raised border border-blue-300/10 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-blue-300/30 focus:ring-1 focus:ring-blue-300/20 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full container-pill-r py-3 bg-blue-300 text-bg-deep font-medium text-sm hover:bg-blue-200 hover:shadow-[0_0_20px_rgba(124,185,232,0.15)] transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Don&apos;t have an account?{" "}
            <Link
              href={`/signup${redirect !== "/account" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
              className="text-blue-300 hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
