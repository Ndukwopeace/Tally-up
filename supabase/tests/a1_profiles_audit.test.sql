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
-- Fixtures: one user per case. Fixed ids keep failure messages readable.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'old.admin@example.test'),
  ('00000000-0000-0000-0000-00000000000c', 'distributor@example.test'),
  ('00000000-0000-0000-0000-00000000000d', 'manager@example.test'),
  ('00000000-0000-0000-0000-00000000000e', 'no.profile@example.test');

insert into public.profiles (id, full_name, email, role, status) values
  ('00000000-0000-0000-0000-00000000000a', 'Active Admin', 'admin@example.test', 'admin', 'active'),
  ('00000000-0000-0000-0000-00000000000b', 'Inactive Admin', 'old.admin@example.test', 'admin', 'inactive'),
  ('00000000-0000-0000-0000-00000000000c', 'A Distributor', 'distributor@example.test', 'distributor', 'active'),
  ('00000000-0000-0000-0000-00000000000d', 'A Manager', 'manager@example.test', 'depot_manager', 'active');

insert into public.audit_log (user_id, action, record_type, record_id)
values ('00000000-0000-0000-0000-00000000000c', 'login', 'profile', '00000000-0000-0000-0000-00000000000c');

-- Signs the current transaction in as `uid` (or out, when null), like a request
-- carrying that user's JWT. pg_temp: exists only for this test session.
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
  $$insert into public.profiles (id, full_name, email, role)
    values ('00000000-0000-0000-0000-00000000000e', 'Copy', 'ADMIN@example.test', 'admin')$$,
  '23505', null, 'USR-02: an email is used by one account only, whatever its letter case');
select throws_ok(
  $$insert into public.profiles (id, full_name, email, role)
    values ('00000000-0000-0000-0000-00000000000e', '   ', 'no.profile@example.test', 'admin')$$,
  '23514', null, 'USR-02: full name cannot be blank');
select is((select status::text from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'active', 'new accounts start Active');

-- ---------------------------------------------------------------------------
-- Signed out (anon): sees and does nothing.
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as(null);
select throws_ok('select count(*) from public.profiles', '42501', null,
  'AUTH-10: a signed-out visitor cannot read profiles');
select throws_ok('select count(*) from public.audit_log', '42501', null,
  'AUTH-10: a signed-out visitor cannot read the audit log');
select throws_ok($$select public.record_login('password')$$, '42501', null,
  'AUD-03: a signed-out visitor cannot write a login entry');
select throws_ok('select public.is_admin()', '42501', null,
  'a signed-out visitor cannot call the role helpers');

-- ---------------------------------------------------------------------------
-- Distributor: own profile only; no audit log.
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000c');
select results_eq('select id from public.profiles',
  $$values ('00000000-0000-0000-0000-00000000000c'::uuid)$$,
  'AUTH-10: a distributor sees only their own profile');
select is(public.current_app_role(), 'distributor'::public.app_role,
  'current_app_role() gives the caller''s role from profiles');
select is(public.is_admin(), false, 'a distributor is not an admin');
select is_empty('select id from public.audit_log',
  'AUD-04: a distributor cannot read the audit log');
select throws_ok(
  $$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c'$$,
  '42501', null, 'SECURITY: a user cannot make themselves admin');
select throws_ok(
  $$insert into public.profiles (id, full_name, email, role)
    values ('00000000-0000-0000-0000-00000000000e', 'Me', 'no.profile@example.test', 'admin')$$,
  '42501', null, 'AUTH-02: a user cannot create an account');
select throws_ok(
  $$insert into public.audit_log (user_id, action) values ('00000000-0000-0000-0000-00000000000c', 'login')$$,
  '42501', null, 'AUD-02: nobody writes the audit log directly');

-- Depot manager: same as distributor for A1.
select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000d');
select results_eq('select id from public.profiles',
  $$values ('00000000-0000-0000-0000-00000000000d'::uuid)$$,
  'AUTH-10: a depot manager sees only their own profile');

-- Signed in, but no profile (e.g. a stray auth user): sees nothing, is no role.
select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000e');
select is_empty('select id from public.profiles', 'a user with no profile sees no profiles');
select is(public.current_app_role(), null, 'a user with no profile has no role');
select throws_ok($$select public.record_login('password')$$, 'P0001',
  'NO_ACTIVE_ACCOUNT', 'AUD-03: a user with no profile cannot write a login entry');

-- ---------------------------------------------------------------------------
-- Active admin: reads everything; still cannot write directly.
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.profiles), 4, 'USR-01: an active admin sees every profile');
select is(public.is_admin(), true, 'an active admin is an admin');
select is((select count(*)::int from public.audit_log), 1, 'AUD-04: an active admin reads the audit log');
select throws_ok(
  $$update public.profiles set full_name = 'X' where id = '00000000-0000-0000-0000-00000000000c'$$,
  '42501', null, 'A1: profile changes go through the admin API (A2), not direct writes');
select throws_ok(
  $$delete from public.audit_log$$, '42501', null, 'AUD-01: audit entries cannot be deleted');

-- Login entry: written for the caller only, with the sign-in method.
select lives_ok($$select public.record_login('password')$$, 'AUD-03: an active admin records their login');
select throws_ok($$select public.record_login('magic')$$, 'P0001', 'INVALID_LOGIN_METHOD',
  'AUD-03: only password or google are accepted as the method');

reset role;
select results_eq(
  $$select user_id, action, record_type, record_id, details ->> 'method'
      from public.audit_log where action = 'login' and user_id = '00000000-0000-0000-0000-00000000000a'$$,
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid, 'login', 'profile',
            '00000000-0000-0000-0000-00000000000a', 'password')$$,
  'AUD-02: the entry holds who, what, record type and id');
select ok((select created_at is not null from public.audit_log
            where user_id = '00000000-0000-0000-0000-00000000000a'),
  'AUD-02: the server sets the time');

-- ---------------------------------------------------------------------------
-- Inactive admin: treated as no admin at all (AUTH-09).
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as('00000000-0000-0000-0000-00000000000b');
select results_eq('select id, status::text from public.profiles',
  $$values ('00000000-0000-0000-0000-00000000000b'::uuid, 'inactive')$$,
  'AUTH-09: an inactive user sees only their own profile, so the app can say why they are refused');
select is(public.is_admin(), false, 'AUTH-09: an inactive admin is not an admin');
select is_empty('select id from public.audit_log', 'AUTH-09: an inactive admin cannot read the audit log');
select throws_ok($$select public.record_login('password')$$, 'P0001', 'NO_ACTIVE_ACCOUNT',
  'AUTH-09: an inactive user cannot record a login');

select * from finish();
rollback;
