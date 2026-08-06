-- Daisy Chain — RLS remediation (2026-08-06 audit, findings C3 / F-1..F-5)
--
-- WHY: these policies have no `TO service_role` clause. In Postgres a policy
-- with no TO defaults to PUBLIC, which includes `anon` — the key that ships in
-- the website's JavaScript. The service-role key bypasses RLS entirely, so
-- these policies were never needed for the server; they only ever granted
-- access to the public.
--
-- VERIFIED LIVE on 2026-08-06: the anon key could read download_tokens,
-- guest_purchases and processed_stripe_events (customer emails + live tokens).

drop policy if exists "Service role can update profiles"                    on public.profiles;
drop policy if exists "Service role can insert profiles"                    on public.profiles;
drop policy if exists "Service role can insert purchases"                   on public.purchases;
drop policy if exists "Service role full access"                            on public.download_tokens;
drop policy if exists "Service role full access on guest_purchases"         on public.guest_purchases;
drop policy if exists "Service role full access on processed_stripe_events" on public.processed_stripe_events;

-- Belt and braces: no grant means no access even if a policy is re-added later.
revoke all on public.download_tokens          from anon, authenticated;
revoke all on public.guest_purchases          from anon, authenticated;
revoke all on public.processed_stripe_events  from anon, authenticated;

-- Confirm the result. Expect: nothing for the three tables above; profiles and
-- purchases keep only their auth.uid()-scoped policies.
select tablename, policyname, roles, cmd from pg_policies
where schemaname = 'public' order by tablename, policyname;
