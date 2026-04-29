import { NextRequest, NextResponse } from "next/server";

const PUBLICATION_ID = "pub_c63c3433-d698-4e9b-b9cc-de4a2af0b2ed";

/**
 * Subscribe an email to beehiiv (Daisy Chain Mail newsletter).
 *
 * Email-only channel. Phone-number / SMS subscriptions go to Laylo via the
 * /api/laylo-subscribe endpoint, called from the account-signup flow — those
 * are intentionally separate audiences (text-list subscribers don't auto-get
 * Chain Mail and vice versa).
 */
export async function POST(req: NextRequest) {
  let email: string;
  try {
    const body = await req.json();
    email = body.email?.trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  try {
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

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("beehiiv error:", res.status, data);
      return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Newsletter error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
