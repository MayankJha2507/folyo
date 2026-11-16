-- 0001_profiles.sql — profiles, platform admins, audit log, and the policy
-- helper functions the rest of the schema depends on.

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user
-- ---------------------------------------------------------------------------
-- Deliberately holds no AI consent column: consent is a versioned ledger
-- (docs/PLAN.md §8), not a timestamp on the profile.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  avatar_url  text,
  locale      text not null default 'en',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;
-- FORCE applies policies even to the table owner, so a future migration run as
-- owner cannot quietly read everything.
alter table public.profiles force row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No INSERT or DELETE policy: rows are created by the trigger below and
-- removed only by cascade from auth.users.

-- ---------------------------------------------------------------------------
-- platform_admins — the source of truth for platform administration
-- ---------------------------------------------------------------------------
-- Never a JWT claim, which a user could influence.
create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  granted_by  uuid references auth.users (id),
  granted_at  timestamptz not null default now(),
  note        text
);

alter table public.platform_admins enable row level security;
alter table public.platform_admins force row level security;

-- An admin may see that they are one. Nobody can grant themselves admin
-- through the API: there is no INSERT/UPDATE/DELETE policy at all, so only the
-- service-role path (which bypasses RLS) can write here.
drop policy if exists platform_admins_select_self on public.platform_admins;
create policy platform_admins_select_self on public.platform_admins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- audit_log — every service-role action
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id           bigserial primary key,
  actor_id     uuid references auth.users (id),
  action       text not null,
  target_type  text not null,
  target_id    text not null,
  meta         jsonb not null default '{}'::jsonb,
  at           timestamptz not null default now()
);

create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id, at desc);

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;
-- No policies: readable and writable only through the service-role path.

-- ---------------------------------------------------------------------------
-- Policy helpers
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so a policy can consult a table the caller cannot read,
-- which is what stops policies recursing. search_path is pinned on every one
-- of these: a SECURITY DEFINER function with a mutable search_path is a
-- privilege-escalation hole.

create or replace function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  );
$$;

revoke all on function app.is_platform_admin() from public, anon;
grant execute on function app.is_platform_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Profile creation on sign-up
-- ---------------------------------------------------------------------------
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function app.touch_updated_at();
