import { stripe } from "@/lib/stripe";
import { validateDownloadToken } from "@/lib/download-tokens";

/** Session-redirect access window, matching the emailed token's 7-day expiry. */
const SESSION_ACCESS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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
  //
  // A session grants access to exactly ONE release: the one named in its
  // metadata.slug. Only single-release digital checkouts set that field —
  // cart, physical and unlimited_pass sessions do not, and must never satisfy
  // this check (a physical session id is handed to the buyer in the shop
  // return_url, so treating "no slug" as "any slug" made every paid order a
  // master key to the whole catalog). Compare affirmatively: undefined never
  // equals a real slug, so unknown session shapes fail closed.
  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent.latest_charge"],
      });
      if (session.payment_status !== "paid") return { status: "invalid" };
      if (session.metadata?.slug !== slug) return { status: "invalid" };

      // Refunds/chargebacks do not change a session's payment_status, so check
      // the charge directly — otherwise a refunded buyer keeps downloading.
      const pi = session.payment_intent;
      const charge =
        pi && typeof pi !== "string" ? pi.latest_charge : null;
      if (charge && typeof charge !== "string") {
        if (charge.refunded || (charge.amount_refunded ?? 0) > 0) {
          return { status: "invalid" };
        }
      }

      // Redirect links are permanent otherwise — Stripe sessions stay
      // retrievable forever. Match the emailed token's 7-day window.
      const ageMs = Date.now() - session.created * 1000;
      if (ageMs > SESSION_ACCESS_WINDOW_MS) return { status: "invalid" };

      return { status: "valid", trackKey: session.metadata?.trackKey || null };
    } catch {
      return { status: "error" };
    }
  }

  return { status: "invalid" };
}
