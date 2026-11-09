-- AI Dietary Coach schema.
-- Paste this whole file into the Supabase SQL Editor. It is safe to run again:
-- it creates missing tables and columns, turns on Row Level Security, and adds
-- policies only when that policy name is not already there.
-- It does not drop, delete, or truncate anything.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  age integer,
  sex text,
  height_cm numeric,
  weight_kg numeric,
  activity_level text,
  goal text,
  allergies text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.food_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_name text not null default '',
  weight_grams numeric,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fiber numeric not null default 0,
  sugar numeric not null default 0,
  note text,
  logged_at timestamptz not null default now()
);

create table if not exists public.bmi_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bmi numeric,
  category text,
  height_cm numeric,
  weight_kg numeric,
  age integer,
  sex text,
  activity_level text,
  goal text,
  diet_plan jsonb,
  recorded_at timestamptz not null default now()
);

create table if not exists public.daily_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null default current_date,
  food_name text not null default '',
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fiber numeric not null default 0,
  sugar numeric not null default 0,
  source text not null default 'manual',
  meal text,
  note text,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists age integer;
alter table public.profiles add column if not exists sex text;
alter table public.profiles add column if not exists height_cm numeric;
alter table public.profiles add column if not exists weight_kg numeric;
alter table public.profiles add column if not exists activity_level text;
alter table public.profiles add column if not exists goal text;
alter table public.profiles add column if not exists allergies text[] not null default '{}';
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.food_log add column if not exists user_id uuid;
alter table public.food_log add column if not exists food_name text not null default '';
alter table public.food_log add column if not exists weight_grams numeric;
alter table public.food_log add column if not exists calories numeric not null default 0;
alter table public.food_log add column if not exists protein numeric not null default 0;
alter table public.food_log add column if not exists carbs numeric not null default 0;
alter table public.food_log add column if not exists fat numeric not null default 0;
alter table public.food_log add column if not exists fiber numeric not null default 0;
alter table public.food_log add column if not exists sugar numeric not null default 0;
alter table public.food_log add column if not exists note text;
alter table public.food_log add column if not exists logged_at timestamptz not null default now();

alter table public.bmi_history add column if not exists user_id uuid;
alter table public.bmi_history add column if not exists bmi numeric;
alter table public.bmi_history add column if not exists category text;
alter table public.bmi_history add column if not exists height_cm numeric;
alter table public.bmi_history add column if not exists weight_kg numeric;
alter table public.bmi_history add column if not exists age integer;
alter table public.bmi_history add column if not exists sex text;
alter table public.bmi_history add column if not exists activity_level text;
alter table public.bmi_history add column if not exists goal text;
alter table public.bmi_history add column if not exists diet_plan jsonb;
alter table public.bmi_history add column if not exists recorded_at timestamptz not null default now();

alter table public.daily_log add column if not exists user_id uuid;
alter table public.daily_log add column if not exists log_date date not null default current_date;
alter table public.daily_log add column if not exists food_name text not null default '';
alter table public.daily_log add column if not exists calories numeric not null default 0;
alter table public.daily_log add column if not exists protein numeric not null default 0;
alter table public.daily_log add column if not exists carbs numeric not null default 0;
alter table public.daily_log add column if not exists fat numeric not null default 0;
alter table public.daily_log add column if not exists fiber numeric not null default 0;
alter table public.daily_log add column if not exists sugar numeric not null default 0;
alter table public.daily_log add column if not exists source text not null default 'manual';
alter table public.daily_log add column if not exists meal text;
alter table public.daily_log add column if not exists note text;
alter table public.daily_log add column if not exists logged_at timestamptz not null default now();
alter table public.daily_log add column if not exists created_at timestamptz not null default now();

create index if not exists food_log_user_logged_idx on public.food_log (user_id, logged_at desc);
create index if not exists bmi_history_user_recorded_idx on public.bmi_history (user_id, recorded_at desc);
create index if not exists daily_log_user_date_idx on public.daily_log (user_id, log_date);

alter table public.profiles enable row level security;
alter table public.food_log enable row level security;
alter table public.bmi_history enable row level security;
alter table public.daily_log enable row level security;

-- Creates a policy only when that name is missing. Existing policies are left as they are.
do $$
declare
  spec record;
  already boolean;
begin
  for spec in
    select *
    from (
      values
        ('profiles'::text, 'profiles_select_own'::text, 'select'::text, 'auth.uid() = id'::text, null::text),
        ('profiles', 'profiles_insert_own', 'insert', null, 'auth.uid() = id'),
        ('profiles', 'profiles_update_own', 'update', 'auth.uid() = id', 'auth.uid() = id'),
        ('profiles', 'profiles_delete_own', 'delete', 'auth.uid() = id', null),
        ('food_log', 'food_log_select_own', 'select', 'auth.uid() = user_id', null),
        ('food_log', 'food_log_insert_own', 'insert', null, 'auth.uid() = user_id'),
        ('food_log', 'food_log_update_own', 'update', 'auth.uid() = user_id', 'auth.uid() = user_id'),
        ('food_log', 'food_log_delete_own', 'delete', 'auth.uid() = user_id', null),
        ('bmi_history', 'bmi_history_select_own', 'select', 'auth.uid() = user_id', null),
        ('bmi_history', 'bmi_history_insert_own', 'insert', null, 'auth.uid() = user_id'),
        ('bmi_history', 'bmi_history_update_own', 'update', 'auth.uid() = user_id', 'auth.uid() = user_id'),
        ('bmi_history', 'bmi_history_delete_own', 'delete', 'auth.uid() = user_id', null),
        ('daily_log', 'daily_log_select_own', 'select', 'auth.uid() = user_id', null),
        ('daily_log', 'daily_log_insert_own', 'insert', null, 'auth.uid() = user_id'),
        ('daily_log', 'daily_log_update_own', 'update', 'auth.uid() = user_id', 'auth.uid() = user_id'),
        ('daily_log', 'daily_log_delete_own', 'delete', 'auth.uid() = user_id', null)
    ) as policy(table_name, policy_name, command_name, using_expr, check_expr)
  loop
    select exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = spec.table_name
        and policyname = spec.policy_name
    )
    into already;

    if already then
      continue;
    end if;

    execute format(
      'create policy %I on public.%I for %s to authenticated%s%s',
      spec.policy_name,
      spec.table_name,
      spec.command_name,
      case
        when spec.using_expr is null then ''
        else format(' using (%s)', spec.using_expr)
      end,
      case
        when spec.check_expr is null then ''
        else format(' with check (%s)', spec.check_expr)
      end
    );
  end loop;
end $$;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.food_log to authenticated;
grant select, insert, update, delete on public.bmi_history to authenticated;
grant select, insert, update, delete on public.daily_log to authenticated;

notify pgrst, 'reload schema';
