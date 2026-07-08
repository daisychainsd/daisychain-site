-- FIX: download_tokens + guest_purchases were readable by the public anon key
-- (paywall bypass + customer-email leak). The `for all using (true)` policies
-- defaulted to `to public`, so NEXT_PUBLIC_SUPABASE_ANON_KEY could SELECT every row.
--
-- All server code uses the service-role client, which BYPASSES RLS entirely.
-- So we just drop the permissive policies: RLS stays enabled, anon/authenticated
-- get zero rows, service role is unaffected. Verified 2026-07-03.

drop policy if exists "Service role full access" on public.download_tokens;
drop policy if exists "Service role full access on guest_purchases" on public.guest_purchases;

-- (Optional, same idea for consistency — these tables hold no PII but are also
--  service-role-only; leaving their policies is harmless since they expose nothing useful.)
-- drop policy if exists "Service role full access on processed_stripe_events" on public.processed_stripe_events;
