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
