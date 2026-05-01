import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const { sessionId, slug } = await req.json();

  if (!sessionId) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ valid: false });
    }

    // Cross-check: the slug being downloaded must match the slug that was purchased.
    // Without this, a buyer of Release A could use their session_id on /download/release-b.
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
