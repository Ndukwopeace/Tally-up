-- -----------------------------------------------------------------------------
-- Milestone A1 (Admin login): accounts, roles, audit log, login entries.
--
-- WHY:  Login needs to know who a signed-in person is in Tally-Up: their name,
--       role and whether the account is active (AUTH-07, AUTH-09). That lives
--       in `profiles`, never in data the user can edit (ARCHITECTURE §5.2).
--       Logins must be recorded in the audit log (AUD-02, AUD-03).
-- HOW:  - Two enums: the three roles (§4) and Active/Inactive (§8).
--       - `profiles`: one row per account, same id as Supabase's auth user.
--       - `audit_log`: who did what, when, to which record.
--       - Helpers `current_app_role()` / `is_admin()` used by RLS policies.
--       - `record_login(method)`: the only way to write a login entry.
--       - RLS on both tables; every default grant removed, then only the
--         reads each role needs are granted back (SEC-2).
-- WHEN: Applied once per Supabase project (staging first, then production,
--       DB-3) by pasting into the SQL editor, or with the Supabase CLI.
--       Never edit this file after it is merged (DB-2); add a new migration.
-- SECURITY: Signed-out visitors (anon) get nothing. A signed-in user reads
--       only their own profile. Only an *active* admin reads all profiles and
--       the audit log. Nobody can insert, change or delete profiles or audit
--       entries through the API in A1: accounts are created by an admin in A2
--       through a server function that uses the service-role key (USR-01).
-- -----------------------------------------------------------------------------

-- RULE §4: exactly three roles.
create type public.app_role as enum ('admin', 'distributor', 'depot_manager');

-- RULE §8: users, depots and products are Active or Inactive (set by an admin).
create type public.record_status as enum ('active', 'inactive');

-- ---------------------------------------------------------------------------
-- profiles: one Tally-Up account per Supabase auth user (REQUIREMENTS §9, USR-02).
-- The depot link (USR-03) is added with the depots table in A2.
-- ---------------------------------------------------------------------------
create table public.profiles (
  -- Same id as auth.users, so `auth.uid()` finds the caller's profile directly.
  -- `on delete restrict`: accounts are deactivated, never deleted (USR-01).
  id uuid primary key references auth.users (id) on delete restrict,
  full_name text not null check (length(btrim(full_name)) > 0),
  -- The login (USR-02). Kept here so admin screens can list it without reading auth.users.
  email text not null check (length(btrim(email)) > 0),
  phone text,
  role public.app_role not null,
  status public.record_status not null default 'active',
  -- RULE NFR-10: stored in UTC by the server; the client clock is never used.
  created_at timestamptz not null default now()
);

-- RULE USR-02: one account per email, whatever the letter case (Ann@x and ann@x are the same person).
create unique index profiles_email_unique on public.profiles (lower(email));

-- ---------------------------------------------------------------------------
-- audit_log: AUD-02 "user, action, timestamp, affected record type and ID".
-- Written only by database functions and triggers, never directly (ARCHITECTURE §6.1).
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id),
  action text not null check (length(action) > 0),
  record_type text,
  -- Text, not uuid: future record types may use other id forms (e.g. COL-00001).
  record_id text,
  -- Extra facts about the action, e.g. {"method": "google"} for a login.
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- The audit screen (AUD-04, milestone A3) lists newest first.
create index audit_log_created_at_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Role helpers for RLS policies.
-- SECURITY DEFINER so a policy on `profiles` can read `profiles` without
-- triggering its own policy again (infinite recursion). `search_path = ''`
-- forces fully-qualified names, so nobody can plant a look-alike table or
-- function earlier on the search path (Supabase security advice).
-- ---------------------------------------------------------------------------

-- The caller's role, or null when signed out, without a profile, or inactive.
-- RULE AUTH-09: an inactive account has no role at all.
create function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.status = 'active'
$$;

-- True only for an active admin.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

-- ---------------------------------------------------------------------------
-- record_login: writes the AUD-03 "login" entry for the caller.
-- Called by the app right after a successful sign-in has been accepted.
-- SECURITY: takes no user id, so a caller can only log *their own* login;
-- refuses inactive or unknown accounts (AUTH-09).
-- ---------------------------------------------------------------------------
create function public.record_login(login_method text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  -- RULE AUD-03: "login (password or Google)" — nothing else is a login method.
  if login_method is null or login_method not in ('password', 'google') then
    raise exception 'INVALID_LOGIN_METHOD';
  end if;

  -- RULE AUTH-09: only an existing, active account can log in.
  if public.current_app_role() is null then
    raise exception 'NO_ACTIVE_ACCOUNT';
  end if;

  insert into public.audit_log (user_id, action, record_type, record_id, details)
  values (caller, 'login', 'profile', caller::text, jsonb_build_object('method', login_method));
end
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.audit_log enable row level security;

-- RULE AUTH-10 (ARCHITECTURE §6.5): every user reads their own profile.
-- Inactive users too, so the app can tell them "Your account is inactive" (§4.5).
create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- RULE USR-01: an active admin reads every profile.
create policy "profiles: admin reads all"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- RULE AUD-04: only an active admin reads the audit log.
create policy "audit_log: admin reads"
  on public.audit_log for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants. Supabase grants everything in `public` to anon and authenticated by
-- default; remove that and grant back only what is needed (SEC-2).
-- No INSERT / UPDATE / DELETE grant exists for any API role: no policy can
-- ever accidentally allow a write.
-- ---------------------------------------------------------------------------
revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.audit_log from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.audit_log to authenticated;

-- Functions are executable by everyone by default; signed-out visitors get none of them.
revoke all on function public.current_app_role() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.record_login(text) from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.record_login(text) to authenticated;
