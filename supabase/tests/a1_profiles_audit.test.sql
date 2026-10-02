-- -----------------------------------------------------------------------------
-- A1 database tests: profiles, audit_log, role helpers, login audit.
--
-- WHY:  The browser is never trusted (SEC-1). These tests prove the database
--       itself refuses what each kind of caller must not do (SEC-12, AUTH-10):
--       signed-out visitors see nothing, a user sees only their own profile,
--       only an *active* admin sees everyone and the audit log, nobody can
--       write profiles or the audit log directly, and a login entry can only
--       be written for oneself (AUD-02, AUD-03).
-- HOW:  pgTAP inside one transaction that is rolled back at the end. Test
--       users are inserted as the superuser, then each check "signs in" by
--       setting the JWT claims and switching to the `authenticated` role, the
--       same way Supabase's API runs a request.
-- WHEN: scripts/db-test.sh (npm run db:test) and the CI `db-test` job.
-- SECURITY: Fictional users only; everything is rolled back.
-- -----------------------------------------------------------------------------
begin;
select plan(35);

-- ---------------------------------------------------------------------------
-- Helpers (pg_temp: exist only for this test session).
-- ---------------------------------------------------------------------------

-- Fixture user ids, one function per person so each id is written once:
-- active_admin = ...0a, inactive_admin = ...0b, distributor_user = ...0c,
-- manager_user = ...0d, no_profile_user = ...0e (a login with no profile).
create function pg_temp.fixture_id(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(to_hex(n), 12, '0'))::uuid
$$;
create function pg_temp.active_admin() returns uuid language sql immutable as $$ select pg_temp.fixture_id(10) $$;
create function pg_temp.inactive_admin() returns uuid language sql immutable as $$ select pg_temp.fixture_id(11) $$;
create function pg_temp.distributor_user() returns uuid language sql immutable as $$ select pg_temp.fixture_id(12) $$;
create function pg_temp.manager_user() returns uuid language sql immutable as $$ select pg_temp.fixture_id(13) $$;
create function pg_temp.no_profile_user() returns uuid language sql immutable as $$ select pg_temp.fixture_id(14) $$;

-- Signs the current transaction in as `uid` (or out, when null), like a request
-- carrying that user's JWT.
create function pg_temp.sign_in_as(uid uuid) returns void language plpgsql as $$
begin
  reset role;
  if uid is null then
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
end $$;

-- The fixture email of a user id.
create function pg_temp.email_of(id uuid) returns text language sql immutable as $$
  select id || '@example.test'
$$;

-- The statement is refused for lack of privilege (SQLSTATE 42501).
create function pg_temp.refused(statement text, description text) returns text language sql as $$
  select throws_ok(statement, '42501', null, description)
$$;

-- record_login(method) is refused with the database's own error message.
create function pg_temp.login_refused(login_method text, message text, description text)
returns text language sql as $$
  select throws_ok(format('select public.record_login(%L)', login_method), 'P0001', message, description)
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: one user per case. Accounts start Active (column default); b is then deactivated.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email)
select id, pg_temp.email_of(id)
from unnest(array[pg_temp.active_admin(), pg_temp.inactive_admin(), pg_temp.distributor_user(),
                  pg_temp.manager_user(), pg_temp.no_profile_user()]) as id;

-- Each role's name is taken from the enum itself (position 1 = admin, 2 = distributor,
-- 3 = depot_manager), so the fixtures follow the schema.
-- A depot for the test manager: an active depot manager always has one (USR-03, A2b).
insert into public.depots (name, location, address) values ('Test depot', 'Douala', 'Test address');

insert into public.profiles (id, full_name, email, role, depot_id)
select id, full_name, pg_temp.email_of(id), (enum_range(null::public.app_role))[role_position],
  case when role_position = 3 then (select id from public.depots limit 1) end
from (values
  (pg_temp.active_admin(), 'Active Admin', 1),
  (pg_temp.inactive_admin(), 'Inactive Admin', 1),
  (pg_temp.distributor_user(), 'A Distributor', 2),
  (pg_temp.manager_user(), 'A Manager', 3)
) as fixture (id, full_name, role_position);

update public.profiles set status = 'inactive' where id = pg_temp.inactive_admin();

insert into public.audit_log (user_id, action, record_type, record_id)
values (pg_temp.distributor_user(), 'login', 'profile', pg_temp.distributor_user()::text);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------
select enum_has_labels('public', 'app_role', array['admin', 'distributor', 'depot_manager'],
  'RULE §4: exactly three roles');
select enum_has_labels('public', 'record_status', array['active', 'inactive'],
  'RULE §8: users are Active or Inactive');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS is switched on for profiles');
select ok((select relrowsecurity from pg_class where oid = 'public.audit_log'::regclass),
  'RLS is switched on for audit_log');

-- Data rules on profiles (USR-02).
select throws_ok(
  $$insert into public.profiles (id, full_name, email, role) values (pg_temp.no_profile_user(), 'Copy', upper(pg_temp.email_of(pg_temp.active_admin())), (enum_range(null::public.app_role))[2])$$,
  '23505', null, 'USR-02: an email is used by one account only, whatever its letter case');
select throws_ok(
  $$insert into public.profiles (id, full_name, email, role) values (pg_temp.no_profile_user(), '   ', pg_temp.email_of(pg_temp.no_profile_user()), (enum_range(null::public.app_role))[2])$$,
  '23514', null, 'USR-02: full name cannot be blank');
select is((select status::text from public.profiles where id = pg_temp.active_admin()),
  'active', 'new accounts start Active');

-- ---------------------------------------------------------------------------
-- Signed out (anon): sees and does nothing.
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as(null);
select pg_temp.refused('select count(*) from public.profiles', 'AUTH-10: a signed-out visitor cannot read profiles');
select pg_temp.refused('select count(*) from public.audit_log', 'AUTH-10: a signed-out visitor cannot read the audit log');
select pg_temp.refused('select public.record_login(null)', 'AUD-03: a signed-out visitor cannot write a login entry');
select pg_temp.refused('select public.is_admin()', 'a signed-out visitor cannot call the role helpers');

-- ---------------------------------------------------------------------------
-- Distributor: own profile only; no audit log.
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as(pg_temp.distributor_user());
select results_eq('select id from public.profiles', 'select pg_temp.distributor_user()',
  'AUTH-10: a distributor sees only their own profile');
select is(public.current_app_role()::text, 'distributor',
  'current_app_role() gives the caller''s role from profiles');
select is(public.is_admin(), false, 'a distributor is not an admin');
select is_empty('select id from public.audit_log', 'AUD-04: a distributor cannot read the audit log');
select pg_temp.refused($$update public.profiles set role = 'admin' where id = pg_temp.distributor_user()$$,
  'SECURITY: a user cannot make themselves admin');
select pg_temp.refused(
  $$insert into public.profiles (id, full_name, email, role) values (pg_temp.no_profile_user(), 'Me', pg_temp.email_of(pg_temp.no_profile_user()), 'depot_manager')$$,
  'AUTH-02: a user cannot create an account');
select pg_temp.refused($$insert into public.audit_log (user_id, action) values (pg_temp.distributor_user(), 'sign_in')$$,
  'AUD-02: nobody writes the audit log directly');

-- Depot manager: same as distributor for A1.
select pg_temp.sign_in_as(pg_temp.manager_user());
select results_eq('select id from public.profiles order by id', 'select pg_temp.manager_user()',
  'AUTH-10: a depot manager sees only their own profile');

-- Signed in, but no profile (e.g. a stray auth user): sees nothing, is no role.
select pg_temp.sign_in_as(pg_temp.no_profile_user());
select is_empty('table public.profiles', 'a user with no profile sees no profiles');
select is(public.current_app_role(), null, 'a user with no profile has no role');
select pg_temp.login_refused('google', 'NO_ACTIVE_ACCOUNT', 'AUD-03: a user with no profile cannot write a login entry');

-- ---------------------------------------------------------------------------
-- Active admin: reads everything; still cannot write directly.
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as(pg_temp.active_admin());
select is((select count(*)::int from public.profiles), 4, 'USR-01: an active admin sees every profile');
select is(public.is_admin(), true, 'an active admin is an admin');
select is((select count(*)::int from public.audit_log), 1, 'AUD-04: an active admin reads the audit log');
select pg_temp.refused($$update public.profiles set full_name = 'X' where id = pg_temp.distributor_user()$$,
  'A1: profile changes go through the admin API (A2), not direct writes');
select pg_temp.refused('delete from public.audit_log', 'AUD-01: audit entries cannot be deleted');

-- Login entry: written for the caller only, with the sign-in method.
select lives_ok($$select public.record_login('password')$$, 'AUD-03: an active admin records their login');
select pg_temp.login_refused('magic', 'INVALID_LOGIN_METHOD', 'AUD-03: only password or google are accepted as the method');

reset role;
select results_eq(
  $$select user_id, action, record_type, record_id, details ->> 'method'
      from public.audit_log where user_id = pg_temp.active_admin()$$,
  $$select pg_temp.active_admin(), 'login', 'profile', pg_temp.active_admin()::text, 'password'$$,
  'AUD-02: the entry holds who, what, record type and id');
select ok((select created_at is not null from public.audit_log where user_id = pg_temp.active_admin()),
  'AUD-02: the server sets the time');

-- ---------------------------------------------------------------------------
-- Inactive admin: treated as no admin at all (AUTH-09).
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as(pg_temp.inactive_admin());
select results_eq('select id, status::text from public.profiles', 'select pg_temp.inactive_admin(), (enum_range(null::public.record_status))[2]::text',
  'AUTH-09: an inactive user sees only their own profile, so the app can say why they are refused');
select is(public.is_admin(), false, 'AUTH-09: an inactive admin is not an admin');
select is_empty('select id from public.audit_log', 'AUTH-09: an inactive admin cannot read the audit log');
select pg_temp.login_refused('google', 'NO_ACTIVE_ACCOUNT', 'AUTH-09: an inactive user cannot record a login');

select * from finish();
rollback;
