"use client";

import { useState } from "react";

export default function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Something went wrong");
        return;
      }
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong");
    }
  }

  return (
    <section className="py-12 sm:py-16" aria-labelledby="newsletter-heading">
      <div className="max-w-7xl mx-auto px-6">
        <div className="container-organic max-w-xl p-6 sm:p-8">
          {status === "success" ? (
            <div className="py-1" role="status" aria-live="polite">
              <p className="text-label text-blue-300/90 mb-2">Subscribed</p>
              <p className="text-title text-text-primary text-xl sm:text-2xl mb-2">
                you&apos;re on the list
              </p>
              <p className="text-text-secondary text-sm">
                we&apos;ll hit you up when something drops.
              </p>
            </div>
          ) : (
            <>
              <p className="text-label mb-2" id="newsletter-heading">
                Newsletter
              </p>
              <h2 className="text-title text-text-primary text-2xl sm:text-3xl mb-2">
                skip the algorithm
              </h2>
              <p className="text-text-secondary text-sm mb-6 max-w-md">
                New releases and shows — straight to your inbox.
              </p>
              <form
                onSubmit={handleSubmit}
                className="flex flex-col sm:flex-row gap-3 sm:items-stretch"
              >
                <label htmlFor="newsletter-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  required
                  className="min-h-11 flex-1 rounded-lg bg-bg-elevated border border-white/[0.08] px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/40 focus-visible:border-blue-300/30"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="min-h-11 shrink-0 rounded-lg bg-blue-300 px-5 py-3 text-sm font-semibold text-bg-deep hover:bg-blue-200 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep"
                >
                  {status === "loading" ? "Signing up…" : "Subscribe"}
                </button>
              </form>
              {status === "error" && (
                <p className="text-red-400 text-sm mt-3" role="alert">
                  {errorMsg}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
