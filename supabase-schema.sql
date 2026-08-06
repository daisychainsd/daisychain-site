-- Run this SQL in the Supabase SQL Editor to set up the database schema.

-- Profiles table (auto-created on user signup via trigger)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  has_unlimited_pass boolean not null default false,
  unlimited_pass_purchased_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Purchases table (one row per release purchase)
create table if not exists public.purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  release_slug text not null,
  stripe_session_id text not null,
  purchased_at timestamptz not null default now(),
  unique(user_id, release_slug)
);

alter table public.purchases enable row level security;

create policy "Users can read their own purchases"
  on public.purchases for select
  using (auth.uid() = user_id);

-- Service role can insert purchases (from webhook)
create policy "Service role can insert purchases"
  on public.purchases for insert
  with check (true);

-- Service role can update profiles (for unlimited pass)
create policy "Service role can update profiles"
  on public.profiles for update
  using (true);

-- Service role can insert profiles
create policy "Service role can insert profiles"
  on public.profiles for insert
  with check (true);

-- Trigger: auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Download tokens (one-time download links sent via email)
create table if not exists public.download_tokens (
  id uuid default gen_random_uuid() primary key,
  token text not null unique,
  slug text not null,
  email text not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
alter table public.download_tokens enable row level security;
create policy "Service role full access" on public.download_tokens for all using (true) with check (true);
create index idx_download_tokens_token on public.download_tokens (token);

-- Guest purchases (saves guest email + purchase data, separate from auth-required purchases table)
create table if not exists public.guest_purchases (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  release_slug text not null,
  stripe_session_id text not null,
  track_key text,
  purchased_at timestamptz not null default now()
);
alter table public.guest_purchases enable row level security;
create policy "Service role full access on guest_purchases" on public.guest_purchases for all using (true) with check (true);
create index idx_guest_purchases_email on public.guest_purchases (email);

-- Per-track purchasing support (added 2026-05-07)
-- track_key: NULL = full release purchase, non-null = individual track (Sanity _key)
-- The unique constraint on purchases uses COALESCE so NULL (full release) deduplicates correctly.
-- Migration:
--   ALTER TABLE purchases ADD COLUMN IF NOT EXISTS track_key TEXT;
--   ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_user_id_release_slug_key;
--   CREATE UNIQUE INDEX IF NOT EXISTS purchases_user_release_track ON purchases(user_id, release_slug, COALESCE(track_key, '__full__'));
--   ALTER TABLE guest_purchases ADD COLUMN IF NOT EXISTS track_key TEXT;

-- Stripe webhook idempotency (added 2026-06-12)
-- The webhook claims each event.id here exactly once; a duplicate insert (23505)
-- means we already processed it and can skip. Without this table the webhook
-- still works (fails open) but won't dedup duplicate Stripe deliveries.
create table if not exists public.processed_stripe_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);
alter table public.processed_stripe_events enable row level security;
create policy "Service role full access on processed_stripe_events"
  on public.processed_stripe_events for all using (true) with check (true);

-- Dedup guest purchases on (session, track) so a duplicate Stripe delivery can't
-- create a second guest_purchases row / download token / email (added 2026-06-12).
create unique index if not exists guest_purchases_session_track
  on public.guest_purchases (stripe_session_id, coalesce(track_key, '__full__'));

-- ─── 2026-08-06 audit: RLS remediation ───────────────────────────────────
-- The "Service role …" policies below/above have no TO clause, so they applied
-- to PUBLIC (including the browser-shipped anon key) rather than to the service
-- role, which bypasses RLS anyway. Dropped here so a fresh run of this file
-- does not recreate the leak. See scripts/fix-rls-2026-08-06.sql.
drop policy if exists "Service role can update profiles"                    on public.profiles;
drop policy if exists "Service role can insert profiles"                    on public.profiles;
drop policy if exists "Service role can insert purchases"                   on public.purchases;
drop policy if exists "Service role full access"                            on public.download_tokens;
drop policy if exists "Service role full access on guest_purchases"         on public.guest_purchases;
drop policy if exists "Service role full access on processed_stripe_events" on public.processed_stripe_events;
revoke all on public.download_tokens         from anon, authenticated;
revoke all on public.guest_purchases         from anon, authenticated;
revoke all on public.processed_stripe_events from anon, authenticated;
