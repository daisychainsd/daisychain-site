import { stripe } from "@/lib/stripe";
import { validateDownloadToken } from "@/lib/download-tokens";

export type DownloadAccess =
  | { status: "valid"; trackKey: string | null }
  | { status: "invalid" }
  | { status: "error" };

/**
 * Server-side entitlement check for the download page. MUST pass before any
 * audio URL is exposed to the client — the page is the security boundary, not
 * DownloadPanel (which only drives UI state).
 *
 *  - "valid"   → caller may render real download links (optionally restricted
 *                to `trackKey` for single-track purchases).
 *  - "invalid" → token/session is definitively bad (forged, unpaid, wrong
 *                slug). Never expose audio.
 *  - "error"   → infra failure (Stripe/Supabase unreachable). Fail CLOSED for
 *                audio, but the page can show a "try again" state so a legit
 *                buyer just reloads — we don't permanently lock anyone out.
 */
export async function verifyDownloadAccess({
  sessionId,
  token,
  slug,
}: {
  sessionId?: string;
  token?: string;
  slug: string;
}): Promise<DownloadAccess> {
  // Token-based (guest email link). Token is release-scoped; single-track
  // guest purchases use the session_id link instead so trackKey is available.
  if (token) {
    try {
      const result = await validateDownloadToken(token, slug);
      return result.valid
        ? { status: "valid", trackKey: null }
        : { status: "invalid" };
    } catch {
      return { status: "error" };
    }
  }

  // Session-based (Stripe redirect). Carries trackKey in metadata.
  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") return { status: "invalid" };
      const purchasedSlug = session.metadata?.slug;
      if (purchasedSlug && purchasedSlug !== slug) return { status: "invalid" };
      return { status: "valid", trackKey: session.metadata?.trackKey || null };
    } catch {
      return { status: "error" };
    }
  }

  return { status: "invalid" };
}
