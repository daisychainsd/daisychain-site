import { NextRequest, NextResponse } from "next/server";

/**
 * Push a phone number (and optional email) to the Daisy Chain Laylo audience
 * for SMS drop notifications. Called server-side after a successful Supabase
 * signup — the LAYLO_API_KEY stays server-only.
 *
 * Laylo's `subscribeToUser(email, phoneNumber)` GraphQL mutation takes either
 * or both. We route phone-driven signups here; email-only newsletter signups
 * go to /api/newsletter (beehiiv) instead.
 */
const LAYLO_GRAPHQL = "https://laylo.com/api/graphql";

export async function POST(req: NextRequest) {
  let phoneNumber: string | undefined;
  let email: string | undefined;
  try {
    const body = await req.json();
    phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : undefined;
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!phoneNumber && !email) {
    return NextResponse.json({ error: "phoneNumber or email required" }, { status: 400 });
  }

  // Loose E.164 sanity check on phone (e.g. +14155551234). Laylo will do its
  // own validation; this just blocks obvious garbage from leaving our server.
  if (phoneNumber && !/^\+?[1-9]\d{6,14}$/.test(phoneNumber.replace(/[^\d+]/g, ""))) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  const apiKey = process.env.LAYLO_API_KEY;
  if (!apiKey) {
    console.warn("LAYLO_API_KEY not set; skipping Laylo subscribe");
    // Don't 500 the user — signup itself succeeded. Surface a soft 200.
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const res = await fetch(LAYLO_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query:
          "mutation($email: String, $phoneNumber: String) { subscribeToUser(email: $email, phoneNumber: $phoneNumber) }",
        variables: {
          email: email ?? null,
          phoneNumber: phoneNumber ?? null,
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    const hasErrors = Array.isArray(data?.errors) && data.errors.length > 0;

    if (!res.ok || hasErrors) {
      console.error("Laylo subscribe error:", res.status, data);
      return NextResponse.json({ error: "Failed to subscribe to Laylo" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Laylo subscribe network error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
