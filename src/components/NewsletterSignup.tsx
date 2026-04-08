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
    <section className="py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center">
          {status === "success" ? (
            <div className="py-4">
              <p className="text-blue-300 font-semibold text-lg">You're in!</p>
              <p className="text-text-secondary text-sm mt-1">
                We'll keep you posted on events, music, and more.
              </p>
            </div>
          ) : (
            <>
              <p className="text-text-secondary text-base sm:text-lg mb-5">
                Stay up to date with events, music, and more
              </p>
              <form
                onSubmit={handleSubmit}
                className="flex flex-col sm:flex-row gap-3 justify-center"
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="px-4 py-3 rounded-full bg-bg-elevated border border-blue-300/10 text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-blue-300/40 focus:ring-1 focus:ring-blue-300/20 w-full sm:w-72"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="px-6 py-3 rounded-full bg-blue-300 text-bg-deep text-sm font-semibold hover:bg-blue-200 transition-colors disabled:opacity-50 shrink-0"
                >
                  {status === "loading" ? "Signing up..." : "Subscribe"}
                </button>
              </form>
              {status === "error" && (
                <p className="text-red-400 text-sm mt-3">{errorMsg}</p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
