import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { validateDownloadToken } from "@/lib/download-tokens";

export async function POST(req: NextRequest) {
  const { sessionId, slug, token } = await req.json();

  // Token-based verification (from email link)
  if (token && slug) {
    const result = await validateDownloadToken(token, slug);
    return NextResponse.json(result);
  }

  // Session-based verification (from Stripe redirect)
  if (!sessionId) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ valid: false });
    }

    // Cross-check: the slug being downloaded must match the slug that was purchased.
    const purchasedSlug = session.metadata?.slug;
    if (slug && purchasedSlug && slug !== purchasedSlug) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({
      valid: true,
      slug: purchasedSlug,
    });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
