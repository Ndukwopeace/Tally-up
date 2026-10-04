-- -----------------------------------------------------------------------------
-- Stand-in for the parts of Supabase that our migrations depend on.
--
-- WHY:  The database tests (scripts/db-test.sh) run on a plain Postgres, in CI
--       and locally, never against the real Supabase projects. The migrations
--       expect what every Supabase project already has: the `auth` schema with
--       `auth.users` and `auth.uid()`, and the anon / authenticated /
--       service_role database roles.
-- HOW:  Recreates only those pieces, with the same names and behaviour:
--       - `auth.uid()` reads the signed-in user's id from the request's JWT
--         claims, exactly as Supabase does. Tests "sign in" by setting
--         `request.jwt.claims` and switching to the `authenticated` role.
--       - Default privileges grant everything in `public` to the API roles,
--         as Supabase does. This matters: it proves our migrations remove
--         those grants themselves instead of relying on a locked-down default.
-- WHEN: Loaded once by scripts/db-test.sh before the migrations. Never run on
--       Supabase (it already has all of this).
-- SECURITY: Test-only. Contains no keys and no real users.
-- -----------------------------------------------------------------------------

-- API roles. NOLOGIN: in Supabase nobody logs in as these directly; the API
-- switches to them per request.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- auth.users with the columns the migrations and the staging test data (supabase/seed/) use.
-- Supabase's table has a few more; all of these have the same names and types there.
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid,
  aud varchar(255),
  role varchar(255),
  email text,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  confirmation_token varchar(255),
  recovery_token varchar(255),
  email_change_token_new varchar(255),
  email_change varchar(255),
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Same contract as Supabase's auth.uid(): the `sub` claim of the caller's JWT, or null.
create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
    ),
    ''
  )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase's default grants on everything created later in `public`.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
