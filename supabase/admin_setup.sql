-- Admin access and AI usage counts for AI Dietary Coach.
-- Paste this whole file into the Supabase SQL Editor. It is safe to run again.
-- It does not drop, delete, or truncate anything.

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.admins enable row level security;

create table if not exists public.usage_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  feature text not null,
  is_guest boolean not null default true,
  user_id uuid,
  ok boolean not null
);

alter table public.usage_log enable row level security;

create index if not exists usage_log_created_at_idx on public.usage_log (created_at);

revoke all on table public.admins from public, anon, authenticated;
revoke all on table public.usage_log from public, anon, authenticated;

-- First admin. Replace the email, then run this statement by itself:
-- insert into public.admins (user_id) select id from auth.users where email = 'YOUR_EMAIL_HERE';

notify pgrst, 'reload schema';
