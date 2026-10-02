-- -----------------------------------------------------------------------------
-- A2b database tests: depots, their managers, and admin_save_depot().
--
-- WHY:  Depots decide where bread goes and who confirms it. The database must
--       keep one active manager per depot (DEP-03), deactivate a replaced
--       manager (Q-57c), accept only Cameroon phone numbers (Q-57i), show
--       depots only to the people who need them (§6.5), and log each change
--       (AUD-03).
-- HOW:  pgTAP in one rolled-back transaction; callers "sign in" by setting the
--       JWT claims and switching to the `authenticated` role.
-- WHEN: scripts/db-test.sh (npm run db:test) and the CI `db-test` job.
-- SECURITY: Fictional users only; everything is rolled back.
-- -----------------------------------------------------------------------------
begin;
select plan(29);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function pg_temp.fixture_id(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(to_hex(n), 12, '0'))::uuid
$$;
create function pg_temp.admin_user() returns uuid language sql immutable as $$ select pg_temp.fixture_id(30) $$;
create function pg_temp.distributor_user() returns uuid language sql immutable as $$ select pg_temp.fixture_id(31) $$;
create function pg_temp.first_manager() returns uuid language sql immutable as $$ select pg_temp.fixture_id(32) $$;
create function pg_temp.second_manager() returns uuid language sql immutable as $$ select pg_temp.fixture_id(33) $$;

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

create function pg_temp.refused(statement text, description text) returns text language sql as $$
  select throws_ok(statement, '42501', null, description)
$$;
create function pg_temp.rule_refused(statement text, message text, description text) returns text language sql as $$
  select throws_ok(statement, 'P0001', message, description)
$$;

-- Saves a depot as the signed-in caller; returns its id.
create function pg_temp.save(depot_id uuid, depot_name text, phones text[], manager uuid, active boolean)
returns uuid language sql as $$
  select public.admin_save_depot(depot_id, depot_name, 'Douala', 'Near the market', phones,
    case when active then (enum_range(null::public.record_status))[1] else (enum_range(null::public.record_status))[2] end,
    manager)
$$;

create temp table saved (label text primary key, id uuid);
grant all on saved to authenticated;
create function pg_temp.akwa() returns uuid language sql as $$ select id from saved where label = 'akwa' $$;
create function pg_temp.bonaberi() returns uuid language sql as $$ select id from saved where label = 'bonaberi' $$;

-- A profile's status and depot, as text like "active@<depot id>" or "inactive@".
create function pg_temp.manager_state(manager uuid) returns text language sql as $$
  select status::text || '@' || coalesce(depot_id::text, '') from public.profiles where id = manager
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: an admin, a distributor and two depot managers. A manager needs
-- a depot to be active (USR-03), so they start inactive until assigned.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email)
select id, id || '@example.test'
from unnest(array[pg_temp.admin_user(), pg_temp.distributor_user(), pg_temp.first_manager(), pg_temp.second_manager()])
  as id;

insert into public.profiles (id, full_name, email, role, status)
select id, 'Person', id || '@example.test', (enum_range(null::public.app_role))[role_position],
  (enum_range(null::public.record_status))[status_position]
from (values
  (pg_temp.admin_user(), 1, 1),
  (pg_temp.distributor_user(), 2, 1),
  (pg_temp.first_manager(), 3, 2),
  (pg_temp.second_manager(), 3, 2)
) as fixture (id, role_position, status_position);

-- ---------------------------------------------------------------------------
-- Structure and data rules
-- ---------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.depots'::regclass), 'RLS on depots');
select throws_ok(
  $$update public.profiles set status = 'active' where id = pg_temp.first_manager()$$, '23514', null,
  'USR-03: an active depot manager must have a depot');
select throws_ok(
  $$update public.profiles set depot_id = gen_random_uuid() where id = pg_temp.distributor_user()$$, '23514', null,
  'USR-03: only depot managers have a depot');

-- ---------------------------------------------------------------------------
-- Admin creates depots, assigns and replaces managers
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as(pg_temp.admin_user());

insert into saved values ('akwa', pg_temp.save(null, 'Akwa', array['+237677123456', '+237233445566'], null, true));
select is((select phones from public.depots where id = pg_temp.akwa()), array['+237677123456', '+237233445566'],
  'DEP-02 / Q-57i: a depot keeps several Cameroon phone numbers');

insert into saved values ('bonaberi', pg_temp.save(null, 'Bonaberi', array[]::text[], null, true));
select is((select phones from public.depots where id = pg_temp.bonaberi()), array[]::text[],
  'DEP-02: phone numbers are optional');

select pg_temp.rule_refused($$select pg_temp.save(null, 'Bad phone', array['677123456'], null, true)$$,
  'INVALID_DEPOT', 'Q-57i: phone numbers are stored as +237 followed by 9 digits');
select pg_temp.rule_refused($$select pg_temp.save(null, 'Bad phone', array['+237577123456'], null, true)$$,
  'INVALID_DEPOT', 'Q-57i: Cameroon numbers start with 2 or 6');
select pg_temp.rule_refused(
  $$select public.admin_save_depot(null, ' ', 'Douala', 'x', array[]::text[], 'active', null)$$,
  'INVALID_DEPOT', 'DEP-02: name is required');
select pg_temp.rule_refused(
  $$select public.admin_save_depot(null, 'No place', ' ', 'x', array[]::text[], 'active', null)$$,
  'INVALID_DEPOT', 'DEP-02: location is required');

-- Assign the first manager to Akwa: they become active with Akwa as their depot.
select lives_ok($$select pg_temp.save(pg_temp.akwa(), 'Akwa', array[]::text[], pg_temp.first_manager(), true)$$,
  'DEP-02: an admin assigns a manager');
select is(pg_temp.manager_state(pg_temp.first_manager()), 'active@' || pg_temp.akwa(),
  'DEP-03: the assigned manager is active at this depot');

-- Assign the second manager to Akwa: the first is replaced and deactivated (Q-57c).
select lives_ok($$select pg_temp.save(pg_temp.akwa(), 'Akwa', array[]::text[], pg_temp.second_manager(), true)$$,
  'DEP-03: an admin assigns a new manager');
select is(pg_temp.manager_state(pg_temp.second_manager()), 'active@' || pg_temp.akwa(),
  'DEP-03: the new manager runs the depot');
select is(pg_temp.manager_state(pg_temp.first_manager()), 'inactive@',
  'Q-57c: the replaced manager is deactivated and has no depot');

-- Moving the second manager to Bonaberi leaves Akwa without a manager.
select lives_ok($$select pg_temp.save(pg_temp.bonaberi(), 'Bonaberi', array[]::text[], pg_temp.second_manager(), true)$$,
  'a manager can be moved to another depot');
select is((select count(*)::int from public.profiles where depot_id = pg_temp.akwa()), 0,
  'DEP-03: a manager runs one depot at a time');

-- Editing a depot without choosing a manager keeps the current one.
select lives_ok($$select pg_temp.save(pg_temp.bonaberi(), 'Bonaberi Port', array[]::text[], null, false)$$,
  'an admin edits and deactivates a depot');
select is(pg_temp.manager_state(pg_temp.second_manager()), 'active@' || pg_temp.bonaberi(),
  'leaving the manager empty keeps the current manager');
select is((select status::text from public.depots where id = pg_temp.bonaberi()), 'inactive',
  'DEP-01: deactivated, not deleted');

select pg_temp.rule_refused($$select pg_temp.save(pg_temp.akwa(), 'Akwa', array[]::text[], pg_temp.distributor_user(), true)$$,
  'NOT_A_MANAGER', 'DEP-03: only a depot manager account can be assigned');
select pg_temp.rule_refused($$select pg_temp.save(gen_random_uuid(), 'Ghost', array[]::text[], null, true)$$,
  'NOT_FOUND', 'editing a depot that does not exist is refused');

-- ---------------------------------------------------------------------------
-- Audit (AUD-03)
-- ---------------------------------------------------------------------------
reset role;
select results_eq(
  format($$select action from public.audit_log where record_id = %L order by action$$, pg_temp.bonaberi()::text),
  $$values ('depot.created'), ('depot.deactivated'), ('depot.edited'), ('depot.edited'), ('depot.manager_assigned')$$,
  'AUD-03: depot created, edited, deactivated and manager assigned are logged');
select is(
  (select count(*)::int from public.audit_log
    where record_id = pg_temp.first_manager()::text and action = 'user.deactivated'),
  1, 'AUD-03: the replaced manager''s deactivation is logged');

-- ---------------------------------------------------------------------------
-- Who can see depots (ARCHITECTURE §6.5)
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as(pg_temp.distributor_user());
select results_eq('select id from public.depots', 'select pg_temp.akwa()',
  'DEP-06: distributors see active depots only');
select pg_temp.rule_refused($$select pg_temp.save(null, 'Mine', array[]::text[], null, true)$$, 'NOT_ADMIN',
  'SECURITY: a distributor cannot save depots');

select pg_temp.sign_in_as(pg_temp.second_manager());
select results_eq('select id from public.depots', 'select pg_temp.bonaberi()',
  'a depot manager sees their own depot only, even when it is inactive (DEP-06)');

select pg_temp.sign_in_as(null);
select pg_temp.refused('select count(*) from public.depots', 'signed-out visitors see no depots');

select pg_temp.sign_in_as(pg_temp.admin_user());
select is((select count(*)::int from public.depots), 2, 'an admin sees every depot');
select pg_temp.refused('delete from public.depots', 'DEP-01: no hard delete');

select * from finish();
rollback;
