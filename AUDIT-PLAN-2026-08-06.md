# Full Site Audit Plan — 2026-08-06 (v2, post-Codex review)

**Target:** daisychain-site (Next.js 16 + Sanity + Stripe LIVE + Supabase + Shopify + beehiiv/Laylo/Resend)
**Goals:** (1) security posture, (2) customer-flow correctness under realistic and hostile use, (3) durability of what breaks silently.
**Review status:** v1 reviewed adversarially by Codex → **blocked** for allowing production writes. v2 adopts Codex's Phase 0 + revised structure. Findings will be re-reviewed by Codex before the report ships.

---

## Safety rules (v2 — hardened per Codex)

1. **Zero production writes.** No scratch Supabase rows, no newsletter/SMS signups against prod (even test addresses), no Sanity mutations, no cron invocations against prod.
2. **No live Stripe Checkout Sessions in production** — not even unpaid. They pollute ops/revenue surfaces and can fire webhooks later if completed.
3. Dynamic testing runs **local/preview with test keys or mocks only**, after Phase 0 confirms env separation. If preview shares live keys, dynamic payment testing is cancelled and downgraded to static proof.
4. No destructive third-party testing (Shopify inventory, Laylo, beehiiv, Resend).
5. Secrets appear in the report as **names only**, never values.
6. Findings requiring exploitation to prove are documented with code citation + reasoned exploit path, never exploited against prod.

---

## Phase 0 — Safety & environment inventory (no writes)

Must complete before anything else. Establishes what is safe to touch.

- Stripe: production vs preview key mode, webhook endpoint(s) + **which events are actually subscribed** (refund/dispute code is dormant without them)
- Vercel: env separation across Production / Preview / Development — does `dev` share live keys?
- Supabase: project, **actual policies AND grants** (not just one anon select), service-role policy wording
- Sanity: dataset, token scope
- Shopify: app scope, token flow health
- Output: approved test targets + explicit go/no-go for Phase 2 payment testing

## Phase 1 — Static high-risk data-flow review (parallel, findings cite file:line)

| # | Area | Specific targets |
|---|------|------------------|
| 1.1 | **Payment integrity** | `checkout`, `checkout-pass`, `checkout-physical` — is price/qty/variant **server-derived**? Codex pre-flag: `checkout-physical` appears to build Stripe line items from client-supplied `title`/`price`/`quantity`/`imageUrl` → pay $0.01, get a real Shopify draft order. Also: `req.nextUrl.origin` used for success/cancel URLs — can a forged `Host`/forwarded header return checkout to an attacker origin? Metadata size limits, cart-chunk parser |
| 1.2 | **Fulfillment** | webhook signature, idempotency (`processed_stripe_events` — live?), **paid-status checks**, refund/dispute revocation, Shopify draft-order mismatch + failure path, durable record if Shopify + alert both fail |
| 1.3 | **Entitlements** | account downloads, guest tokens (lifetime/scope), `/api/verify-purchase`, per-track filtering, hidden/upcoming audio URL leakage |
| 1.4 | **Public compute** | `/api/convert` — unauthenticated, accepts any `cdn.sanity.io` URL, buffers whole audio, runs ffmpeg: entitlement bypass, cost abuse, size/content-type caps, temp-file handling, can it convert hidden/upcoming audio? Same for Sanity `preview-gen` (mutates + long ffmpeg) |
| 1.5 | **Access control** | `/account`, `/ops`, `/studio`, cron auth. Codex pre-flag: `src/proxy.ts` — missing Supabase env returns **before** the `/studio` check, and unset `STUDIO_PASSWORD` **allows** `/studio` (fail-open), while `/ops` fails closed. Cron endpoints mutate Sanity — authorization, replay, blast radius |
| 1.6 | **Data exposure** | Supabase **policies + grants** (the "Service role full access" policies lack `TO service_role` — verify real effect), GROQ `hidden` filters, `NEXT_PUBLIC_*` surface, **PII on `/ops`** (`runHealthChecks()` pulls recent Stripe sessions + customer emails — weak ops auth = PII + revenue leak) |
| 1.7 | **Per-route input contract** | For each `/api/*` route explicitly: schema validation · body-size cap · server-side lookup · auth/entitlement · third-party write behavior · failure mode. Not a generic "check inputs" sweep |
| 1.8 | **Headers & platform** | Explicit checklist: CSP, HSTS, frame protections (checkout + studio), Referrer-Policy, Permissions-Policy, cookie flags, redirects. `next.config.ts` currently configures images only |

**Every finding is adversarially verified** — a second pass attempts to refute it. Only unrefuted findings ship.

## Phase 2 — Dynamic testing, local/preview only (gated on Phase 0)

Realistic customer activity plus the clumsy/hostile variants real users produce. Test keys or mocks only.

- **Payment tampering:** forged physical cart payload (price/qty/variant), forged digital cart metadata, negative/zero/999 quantities
- **Entitlement probes:** slug swap in download URL, expired/bad/reused token, single-track purchase requesting full release, unlimited-pass overlap
- **Convert abuse:** allowed-CDN URL reuse, oversized input, repeat hammering (≤5 requests)
- **Webhook replay:** duplicate delivery via Stripe CLI test mode → confirm idempotency actually dedups
- **Cron:** unauthorized request → confirm rejection
- **Auth flows:** signup with already-registered email, unconfirmed email, redirect param tampering, session expiry mid-purchase
- **Clumsy-user paths:** back button after pay, refresh success page, share success URL, reload mid-checkout, double-submit
- **CMS edge cases:** release missing cover/price/tracks, event with null date (the #24 class), hidden doc via direct slug

## Phase 3 — Production read-only verification

Headers, route exposure, `/ops` + `/studio` gating behavior, webhook event subscriptions, Supabase policy/grant state, Vercel env separation. **No POSTs** except harmless unauthenticated rejection checks.

## Phase 4 — Report triage

`AUDIT-2026-08-06.md`. Every finding: file:line · exploit path · business impact · concrete fix. **Separate "confirmed production risk" from "local/static risk."** Severity-ranked. No fixes applied without PD approval.

---

## Cut per Codex (low value / noise)

- `npm audit` as a headline deliverable (only if triaged to reachable prod paths)
- Weak-password testing (Supabase-owned policy)
- Google Doc embed failure modes
- `dc-email-api` Shotgun cursor (out of repo scope — noted only)
- Generic happy-path browsing — time reallocated to payment/download/fulfillment invariants

## Out of scope

Fixes (audit-only unless approved) · other repos · Parcel Sound / Shopify POS · design review
