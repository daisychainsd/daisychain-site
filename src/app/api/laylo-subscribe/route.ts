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

  // Normalize phone to E.164 (Laylo requires + and country code).
  // - "9499391823" (10 digits)        → "+19499391823"   (assume US)
  // - "19499391823" (11 digits, US)   → "+19499391823"
  // - "+19499391823"                  → unchanged
  // - "+44 7700 900 123"              → "+447700900123"  (any non-digit stripped)
  if (phoneNumber) {
    const digits = phoneNumber.replace(/[^\d+]/g, "");
    if (digits.startsWith("+")) {
      phoneNumber = "+" + digits.slice(1).replace(/\D/g, "");
    } else {
      const justDigits = digits.replace(/\D/g, "");
      if (justDigits.length === 10) {
        phoneNumber = "+1" + justDigits;
      } else if (justDigits.length === 11 && justDigits.startsWith("1")) {
        phoneNumber = "+" + justDigits;
      } else {
        return NextResponse.json(
          { error: "Phone number must include country code (e.g. +1 for US)" },
          { status: 400 },
        );
      }
    }
    // Final sanity: + then 8-15 digits.
    if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }
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
      console.error("Laylo subscribe error:", res.status, JSON.stringify(data));
      const detail =
        data?.errors?.[0]?.message ||
        data?.error ||
        `HTTP ${res.status}`;
      return NextResponse.json(
        { error: `Failed to subscribe (${detail})` },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Laylo subscribe network error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
