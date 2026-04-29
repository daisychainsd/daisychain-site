import { NextRequest, NextResponse } from "next/server";

const PUBLICATION_ID = "pub_c63c3433-d698-4e9b-b9cc-de4a2af0b2ed";
const LAYLO_GRAPHQL = "https://laylo.com/api/graphql";

/**
 * Subscribe an email to beehiiv (Daisy Chain Mail newsletter) AND Laylo (drop CRM).
 *
 * Both pushes fire in parallel. Either failing is logged but does NOT cause the
 * request to fail — the user is treated as successfully subscribed if at least
 * the beehiiv push succeeded (it's the primary newsletter list). Laylo is a
 * secondary fan-CRM push for drop notifications + SMS marketing.
 *
 * Phone-number capture is not wired in this route yet — Laylo's `subscribeToUser`
 * mutation accepts an optional `phoneNumber` arg; when LeadGen gets a phone
 * field, pass it through here and forward to Laylo.
 *
 * Env:
 *   BEEHIIV_API_KEY  required (route 503s without it)
 *   LAYLO_API_KEY    optional (Laylo push silently skipped if missing)
 */
export async function POST(req: NextRequest) {
  let email: string;
  let phoneNumber: string | undefined;
  try {
    const body = await req.json();
    email = body.email?.trim().toLowerCase();
    phoneNumber = body.phoneNumber?.trim() || undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const beehiivKey = process.env.BEEHIIV_API_KEY;
  if (!beehiivKey) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Fire both pushes in parallel, settle even if one fails.
  const [beehiivResult, laylo] = await Promise.allSettled([
    pushBeehiiv(email, beehiivKey),
    pushLaylo(email, phoneNumber),
  ]);

  // beehiiv is the primary list — its failure is the route's failure.
  if (beehiivResult.status === "rejected" || (beehiivResult.status === "fulfilled" && !beehiivResult.value.ok)) {
    const detail = beehiivResult.status === "rejected" ? beehiivResult.reason : beehiivResult.value;
    console.error("beehiiv push failed:", detail);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }

  // Laylo is best-effort — log but never fail the user-visible request.
  if (laylo.status === "rejected") {
    console.error("laylo push failed:", laylo.reason);
  } else if (!laylo.value.ok && !laylo.value.skipped) {
    console.error("laylo push non-ok:", laylo.value);
  }

  return NextResponse.json({ ok: true });
}

async function pushBeehiiv(email: string, apiKey: string) {
  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/subscriptions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email,
        utm_source: "daisychainsd.com",
        utm_medium: "website",
        utm_campaign: "homepage_signup",
      }),
    },
  );
  return { ok: res.ok, status: res.status };
}

async function pushLaylo(email: string, phoneNumber?: string) {
  const apiKey = process.env.LAYLO_API_KEY;
  if (!apiKey) {
    return { ok: false, skipped: true as const };
  }
  const res = await fetch(LAYLO_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query:
        "mutation($email: String, $phoneNumber: String) { subscribeToUser(email: $email, phoneNumber: $phoneNumber) }",
      variables: { email, phoneNumber: phoneNumber ?? null },
    }),
  });
  // GraphQL endpoints return 200 even on errors; check response body.
  const data = await res.json().catch(() => ({}));
  const hasErrors = Array.isArray(data?.errors) && data.errors.length > 0;
  return { ok: res.ok && !hasErrors, status: res.status, data, skipped: false as const };
}
