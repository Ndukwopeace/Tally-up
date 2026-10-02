-- -----------------------------------------------------------------------------
-- A2c database tests: user accounts, phones, and the rules around them.
--
-- WHY:  Accounts decide who can sign in and what they can see. The database
--       must keep the rules even if the server function or the app is wrong:
--       a depot manager has a depot while active (USR-03), a replaced manager
--       is deactivated (Q-57c), role changes remove the depot (Q-57g), an admin
--       cannot deactivate themselves and the last active admin stays an admin
--       (Q-57f, USR-06), phones are Cameroon numbers (Q-57i), and every change
--       is logged (AUD-03).
-- HOW:  pgTAP in one rolled-back transaction. admin_save_user() and
--       admin_record_password_reset() are called the way the Vercel Function
--       calls them: by the service role, naming the admin who asked.
-- WHEN: scripts/db-test.sh (npm run db:test) and the CI `db-test` job.
-- SECURITY: Fictional users only; everything is rolled back.
-- -----------------------------------------------------------------------------
begin;
select plan(49);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function pg_temp.fixture_id(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(to_hex(n), 12, '0'))::uuid
$$;
create function pg_temp.first_admin() returns uuid language sql immutable as $$ select pg_temp.fixture_id(40) $$;
create function pg_temp.second_admin() returns uuid language sql immutable as $$ select pg_temp.fixture_id(41) $$;
create function pg_temp.a_distributor() returns uuid language sql immutable as $$ select pg_temp.fixture_id(42) $$;
create function pg_temp.old_admin() returns uuid language sql immutable as $$ select pg_temp.fixture_id(43) $$;
create function pg_temp.first_manager() returns uuid language sql immutable as $$ select pg_temp.fixture_id(50) $$;
create function pg_temp.second_manager() returns uuid language sql immutable as $$ select pg_temp.fixture_id(51) $$;
create function pg_temp.akwa() returns uuid language sql immutable as $$ select pg_temp.fixture_id(60) $$;
create function pg_temp.bonaberi() returns uuid language sql immutable as $$ select pg_temp.fixture_id(61) $$;

-- Saves a user the way the Vercel Function does: the admin who asked, the target, then the values.
create function pg_temp.save_user(
  actor uuid, target uuid, user_name text, user_email text, user_phones text[],
  user_role text, user_status text, user_depot uuid, is_new boolean)
returns void language sql as $$
  select public.admin_save_user(actor, target, user_name, user_email, user_phones,
    user_role::public.app_role, user_status::public.record_status, user_depot, is_new)
$$;

-- A Supabase auth user exists before its profile does, so the function never creates one itself.
create function pg_temp.auth_user(n int) returns uuid language plpgsql as $$
begin
  insert into auth.users (id, email) values (pg_temp.fixture_id(n), n || '@example.test');
  return pg_temp.fixture_id(n);
end $$;

create function pg_temp.rule_refused(statement text, message text, description text) returns text language sql as $$
  select throws_ok(statement, 'P0001', message, description)
$$;

-- "active@<depot id>" or "inactive@": a profile's status and depot.
create function pg_temp.state(who uuid) returns text language sql as $$
  select status::text || '@' || coalesce(depot_id::text, '') from public.profiles where id = who
$$;
create function pg_temp.actions(who uuid) returns text language sql as $$
  select coalesce(string_agg(action, ',' order by action), '') from public.audit_log where record_id = who::text
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: one active admin, a distributor, an inactive admin, two depots and two inactive managers.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email)
select id, id || '@example.test'
from unnest(array[pg_temp.first_admin(), pg_temp.a_distributor(), pg_temp.old_admin(),
                  pg_temp.first_manager(), pg_temp.second_manager()]) as id;
insert into public.profiles (id, full_name, email, role, status)
select id, 'Person', id || '@example.test', (enum_range(null::public.app_role))[role_position],
  (enum_range(null::public.record_status))[status_position]
from (values
  (pg_temp.first_admin(), 1, 1), (pg_temp.a_distributor(), 2, 1), (pg_temp.old_admin(), 1, 2),
  (pg_temp.first_manager(), 3, 2), (pg_temp.second_manager(), 3, 2)
) as fixture (id, role_position, status_position);
insert into public.depots (id, name, location, address)
values (pg_temp.akwa(), 'Akwa', 'Douala', 'Market'), (pg_temp.bonaberi(), 'Bonaberi', 'Douala', 'Port');

-- ---------------------------------------------------------------------------
-- Structure and who may call the functions
-- ---------------------------------------------------------------------------
select has_column('public', 'profiles', 'phones', 'Q-57i: accounts have a list of phone numbers');
select throws_ok($$update public.profiles set phones = array['677123456'] where id = pg_temp.first_admin()$$,
  '23514', null, 'Q-57i: phone numbers are stored as +237 followed by 9 digits');
select is(has_function_privilege('authenticated',
  'public.admin_save_user(uuid, uuid, text, text, text[], public.app_role, public.record_status, uuid, boolean)', 'execute'),
  false, 'SECURITY: a signed-in user cannot call admin_save_user through the API');
select is(has_function_privilege('anon',
  'public.admin_save_user(uuid, uuid, text, text, text[], public.app_role, public.record_status, uuid, boolean)', 'execute'),
  false, 'SECURITY: a signed-out visitor cannot call admin_save_user');
select is(has_function_privilege('authenticated', 'public.admin_record_password_reset(uuid, uuid)', 'execute'),
  false, 'SECURITY: a signed-in user cannot log a password reset through the API');
select is(has_function_privilege('service_role',
  'public.admin_save_user(uuid, uuid, text, text, text[], public.app_role, public.record_status, uuid, boolean)', 'execute'),
  true, 'the server function (service role) can call admin_save_user');

-- ---------------------------------------------------------------------------
-- Creating accounts (USR-01, USR-02)
-- ---------------------------------------------------------------------------
select lives_ok($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.auth_user(70), ' Ann Distributor ',
  ' Ann@Example.test ', array['+237677123456', '+237233445566'], 'distributor', 'active', null, true)$$,
  'USR-01: an admin creates a distributor');
select is((select full_name || '|' || email || '|' || role || '|' || status from public.profiles where id = pg_temp.fixture_id(70)),
  'Ann Distributor|ann@example.test|distributor|active', 'USR-02: name trimmed, email trimmed and lower-cased');
select is((select phones from public.profiles where id = pg_temp.fixture_id(70)), array['+237677123456', '+237233445566'],
  'USR-02 / Q-57i: an account keeps several Cameroon phone numbers');
select pg_temp.rule_refused($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.auth_user(71), 'Ann Again',
  'ANN@example.test', array[]::text[], 'distributor', 'active', null, true)$$,
  'EMAIL_TAKEN', 'USR-02: one account per email, whatever the letter case');
select pg_temp.rule_refused($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.auth_user(72), ' ',
  'blank@example.test', array[]::text[], 'distributor', 'active', null, true)$$,
  'INVALID_USER', 'USR-02: full name is required');
select pg_temp.rule_refused($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.auth_user(73), 'Bad Email',
  'not-an-email', array[]::text[], 'distributor', 'active', null, true)$$,
  'INVALID_USER', 'USR-02: the email must look like an email');
select pg_temp.rule_refused($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.auth_user(74), 'Bad Phone',
  'phone@example.test', array['+237577123456'], 'distributor', 'active', null, true)$$,
  'INVALID_USER', 'Q-57i: Cameroon numbers start with 2 or 6');
select pg_temp.rule_refused($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.fixture_id(70), 'Ann Distributor',
  'again@example.test', array[]::text[], 'distributor', 'active', null, true)$$,
  'INVALID_USER', 'creating over an existing account is refused');

-- ---------------------------------------------------------------------------
-- Depot managers (USR-03, Q-57c, Q-57g)
-- ---------------------------------------------------------------------------
select lives_ok($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.first_manager(), 'Mia Manager',
  'mia@example.test', array[]::text[], 'depot_manager', 'active', pg_temp.akwa(), false)$$,
  'USR-03: an admin makes an account the manager of a depot');
select is(pg_temp.state(pg_temp.first_manager()), 'active@' || pg_temp.akwa(), 'USR-03: the manager is active at that depot');
select lives_ok($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.second_manager(), 'Max Manager',
  'max@example.test', array[]::text[], 'depot_manager', 'active', pg_temp.akwa(), false)$$,
  'DEP-03: a second manager takes over the depot');
select is(pg_temp.state(pg_temp.second_manager()), 'active@' || pg_temp.akwa(), 'DEP-03: the new manager runs the depot');
select is(pg_temp.state(pg_temp.first_manager()), 'inactive@', 'Q-57c: the replaced manager is deactivated and has no depot');
select pg_temp.rule_refused($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.first_manager(), 'Mia Manager',
  'mia@example.test', array[]::text[], 'depot_manager', 'active', null, false)$$,
  'DEPOT_REQUIRED', 'Q-57c: reactivating a manager needs a depot');
select pg_temp.rule_refused($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.auth_user(75), 'No Depot',
  'nodepot@example.test', array[]::text[], 'depot_manager', 'active', null, true)$$,
  'DEPOT_REQUIRED', 'USR-03: a new active depot manager needs a depot');
select pg_temp.rule_refused($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.fixture_id(70), 'Ann Distributor',
  'ann@example.test', array[]::text[], 'distributor', 'active', pg_temp.akwa(), false)$$,
  'INVALID_USER', 'USR-03: a distributor has no depot');
select pg_temp.rule_refused($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.first_manager(), 'Mia Manager',
  'mia@example.test', array[]::text[], 'depot_manager', 'inactive', pg_temp.akwa(), false)$$,
  'INVALID_USER', 'Q-57c: an inactive manager has no depot');
select pg_temp.rule_refused($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.first_manager(), 'Mia Manager',
  'mia@example.test', array[]::text[], 'depot_manager', 'active', gen_random_uuid(), false)$$,
  'INVALID_USER', 'USR-03: the depot must exist');

-- Saving a manager again without a change must not log a new assignment.
select is((select count(*)::int from public.audit_log where action = 'depot.manager_assigned' and record_id = pg_temp.akwa()::text),
  2, 'AUD-03: two manager assignments so far at Akwa');
select lives_ok($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.second_manager(), 'Max Manager Jr',
  'max@example.test', array['+237677000111'], 'depot_manager', 'active', pg_temp.akwa(), false)$$,
  'an admin edits a manager without changing the depot');
select is((select count(*)::int from public.audit_log where action = 'depot.manager_assigned' and record_id = pg_temp.akwa()::text),
  2, 'AUD-03: an edit that keeps the depot logs no new assignment');

-- Q-57c: deactivating a manager takes them off the depot.
select lives_ok($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.second_manager(), 'Max Manager Jr',
  'max@example.test', array[]::text[], 'depot_manager', 'inactive', null, false)$$, 'an admin deactivates a manager');
select is(pg_temp.state(pg_temp.second_manager()), 'inactive@', 'Q-57c: a deactivated manager no longer runs the depot');
select lives_ok($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.second_manager(), 'Max Manager Jr',
  'max@example.test', array[]::text[], 'depot_manager', 'active', pg_temp.bonaberi(), false)$$,
  'an admin reactivates the manager at another depot');
select is(pg_temp.state(pg_temp.second_manager()), 'active@' || pg_temp.bonaberi(), 'Q-57c: reactivated at the chosen depot');

-- Q-57g: email and role can be edited; a manager given another role loses the depot.
select lives_ok($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.second_manager(), 'Max Manager Jr',
  'max.new@example.test', array[]::text[], 'distributor', 'active', null, false)$$,
  'Q-57g: an admin changes a manager''s role and email');
select is((select email || '|' || role || '|' || coalesce(depot_id::text, '') from public.profiles where id = pg_temp.second_manager()),
  'max.new@example.test|distributor|', 'Q-57g: the new role has no depot and the email changed');

-- ---------------------------------------------------------------------------
-- Admins protect themselves (Q-57f, USR-06)
-- ---------------------------------------------------------------------------
select pg_temp.rule_refused($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.first_admin(), 'Person',
  'x@example.test', array[]::text[], 'admin', 'inactive', null, false)$$,
  'CANNOT_DEACTIVATE_SELF', 'USR-06: an admin cannot deactivate their own account');
select pg_temp.rule_refused($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.first_admin(), 'Person',
  'x@example.test', array[]::text[], 'distributor', 'active', null, false)$$,
  'LAST_ADMIN', 'USR-06: the last active admin cannot be given another role');
select lives_ok($$select pg_temp.save_user(pg_temp.first_admin(), pg_temp.auth_user(41), 'Second Admin',
  'admin2@example.test', array[]::text[], 'admin', 'active', null, true)$$, 'USR-01: an admin creates another admin');
select lives_ok($$select pg_temp.save_user(pg_temp.second_admin(), pg_temp.first_admin(), 'Person',
  'x@example.test', array[]::text[], 'admin', 'inactive', null, false)$$,
  'USR-06: an admin deactivates another admin while one stays active');
select pg_temp.rule_refused($$select pg_temp.save_user(pg_temp.second_admin(), pg_temp.second_admin(), 'Second Admin',
  'admin2@example.test', array[]::text[], 'distributor', 'active', null, false)$$,
  'LAST_ADMIN', 'USR-06: now the second admin is the last one and keeps the role');

-- ---------------------------------------------------------------------------
-- Who may ask, and what is refused
-- ---------------------------------------------------------------------------
select pg_temp.rule_refused($$select pg_temp.save_user(pg_temp.a_distributor(), pg_temp.fixture_id(70), 'Ann',
  'ann@example.test', array[]::text[], 'distributor', 'active', null, false)$$,
  'NOT_ADMIN', 'SECURITY: a distributor cannot change accounts');
select pg_temp.rule_refused($$select pg_temp.save_user(pg_temp.old_admin(), pg_temp.fixture_id(70), 'Ann',
  'ann@example.test', array[]::text[], 'distributor', 'active', null, false)$$,
  'NOT_ADMIN', 'AUTH-09 / SECURITY: an inactive admin cannot change accounts');
select pg_temp.rule_refused($$select pg_temp.save_user(gen_random_uuid(), pg_temp.fixture_id(70), 'Ann',
  'ann@example.test', array[]::text[], 'distributor', 'active', null, false)$$,
  'NOT_ADMIN', 'SECURITY: an unknown caller cannot change accounts');
select pg_temp.rule_refused($$select pg_temp.save_user(pg_temp.second_admin(), gen_random_uuid(), 'Ghost',
  'ghost@example.test', array[]::text[], 'distributor', 'active', null, false)$$,
  'NOT_FOUND', 'editing an account that does not exist is refused');

-- ---------------------------------------------------------------------------
-- Password resets and the audit log (USR-04, AUD-03)
-- ---------------------------------------------------------------------------
select lives_ok($$select public.admin_record_password_reset(pg_temp.second_admin(), pg_temp.fixture_id(70))$$,
  'USR-04: an admin''s password reset is logged');
select pg_temp.rule_refused($$select public.admin_record_password_reset(pg_temp.a_distributor(), pg_temp.fixture_id(70))$$,
  'NOT_ADMIN', 'SECURITY: only an admin can log a password reset');
select pg_temp.rule_refused($$select public.admin_record_password_reset(pg_temp.second_admin(), gen_random_uuid())$$,
  'NOT_FOUND', 'a password reset for an unknown account is refused');
select is(pg_temp.actions(pg_temp.fixture_id(70)), 'user.created,user.password_reset',
  'AUD-03: account created and password reset are logged');
select is(pg_temp.actions(pg_temp.second_manager()),
  'user.activated,user.activated,user.deactivated,user.edited,user.edited,user.edited,user.edited,user.edited',
  'AUD-03: edits, deactivation and activation of an account are logged');
select is((select count(*)::int from public.audit_log where action = 'user.created' and user_id = pg_temp.first_admin()), 2,
  'AUD-03: the log names the admin who acted, not the account');

-- ---------------------------------------------------------------------------
-- Reading (ARCHITECTURE §6.5): the new column follows the existing rules
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.a_distributor(), 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*)::int from public.profiles where id <> pg_temp.a_distributor()), 0,
  'AUTH-10: a distributor still reads only their own account, phones included');

select * from finish();
rollback;
