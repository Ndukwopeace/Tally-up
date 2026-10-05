-- -----------------------------------------------------------------------------
-- D1 database tests: submit_collection() and submit_distribution(), the only write paths
-- for a distributor.
--
-- WHY:  These two functions carry the rules that keep the bread numbers true: whole
--       quantities above zero, units a product supports, no same product and unit
--       twice (COL-02 to COL-05), a hand-over only from the distributor's own
--       collection to an active depot, and no giving more than remains per product,
--       compared in loaves (DIS-03 to DIS-06). Nobody can write these tables directly.
-- HOW:  pgTAP in one rolled-back transaction, with the spec's numbers: Big Bread
--       (1 Pack = 10, 1 Caisse = 50 loaves). 1,000 loaves collected as 500 Loaves +
--       10 Caisse.
-- WHEN: scripts/db-test.sh (npm run db:test) and the CI `db-test` job.
-- SECURITY: Fictional users only; everything is rolled back.
-- -----------------------------------------------------------------------------
begin;
select plan(39);

create function pg_temp.id(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(to_hex(n), 12, '0'))::uuid
$$;
create function pg_temp.sign_in_as(uid uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;
-- Ids the functions return, kept for later steps (the test role may write to it).
create temp table ids (k text primary key, v uuid);
grant all on pg_temp.ids to authenticated;

-- Test helpers. They keep each check to one short line so the file is not a wall of
-- repeated JSON (and the duplication gate stays quiet). They add no rule of their own.
-- One line of a request: product number, unit, quantity.
create function pg_temp.line(p int, u text, q numeric) returns jsonb language sql as $$
  select jsonb_build_object('product_id', pg_temp.id(p), 'unit', u, 'quantity', q)
$$;
-- A collection with one line (the usual case in the refusal checks).
create function pg_temp.collect1(p int, u text, q numeric) returns uuid language sql as $$
  select public.submit_collection(jsonb_build_array(pg_temp.line(p, u, q)))
$$;
-- A hand-over from a kept collection (key in `ids`) to a depot number.
create function pg_temp.give(coll text, depot int, lines jsonb) returns uuid language sql as $$
  select public.submit_distribution((select v from pg_temp.ids where k = coll), pg_temp.id(depot), lines)
$$;
-- A hand-over with one line.
create function pg_temp.give1(coll text, depot int, p int, u text, q numeric) returns uuid language sql as $$
  select pg_temp.give(coll, depot, jsonb_build_array(pg_temp.line(p, u, q)))
$$;
-- The call must be refused with this code (every refusal is P0001 plus a plain code).
create function pg_temp.refuses(call text, code text, why text) returns text language sql as $$
  select throws_ok(call, 'P0001', code, why)
$$;
-- The id the call returned, kept under a key for later steps.
create function pg_temp.keep(k text, v uuid) returns void language sql as $$
  insert into pg_temp.ids values (k, v)
$$;
grant execute on all functions in schema pg_temp to authenticated;

insert into auth.users (id, email) select pg_temp.id(n), n || '@example.test' from generate_series(1, 5) as n;
insert into public.depots (id, name, location, address, status)
values (pg_temp.id(10), 'Akwa', 'Douala', 'Market', 'active'),
       (pg_temp.id(11), 'Bonaberi', 'Douala', 'Port', 'active'),
       (pg_temp.id(12), 'Makepe', 'Douala', 'Old road', 'inactive');
insert into public.profiles (id, full_name, email, role, status, depot_id)
values (pg_temp.id(1), 'Admin', '1@example.test', 'admin', 'active', null),
       (pg_temp.id(2), 'Dist One', '2@example.test', 'distributor', 'active', null),
       (pg_temp.id(3), 'Dist Two', '3@example.test', 'distributor', 'active', null),
       (pg_temp.id(4), 'Mgr Akwa', '4@example.test', 'depot_manager', 'active', pg_temp.id(10)),
       (pg_temp.id(5), 'Mgr Bonaberi', '5@example.test', 'depot_manager', 'active', pg_temp.id(11));
insert into public.products (id, name, code, description, status)
values (pg_temp.id(20), 'Big Bread', 'BB-01', 'Big', 'active'),
       (pg_temp.id(21), 'Small Bread', 'SB-01', 'Small', 'active'),
       (pg_temp.id(22), 'Retired Bread', 'RB-01', 'Gone', 'inactive');
insert into public.product_units (product_id, unit, loaves_per_unit)
values (pg_temp.id(20), 'Loaf', 1), (pg_temp.id(20), 'Pack', 10), (pg_temp.id(20), 'Caisse', 50),
       (pg_temp.id(21), 'Loaf', 1), (pg_temp.id(21), 'Caisse', 30),
       (pg_temp.id(22), 'Loaf', 1);

-- ---------------------------------------------------------------------------
-- submit_collection (COL-02 to COL-07)
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as(pg_temp.id(2));
select lives_ok($$select pg_temp.keep('c1', public.submit_collection(jsonb_build_array(
  pg_temp.line(20, 'Loaf', 500), pg_temp.line(20, 'Caisse', 10))))$$,
  'COL-04: the same product in two units is accepted');
reset role;
select results_eq($$select distributor_id, label ~ '^COL-[0-9]{5}$' from public.collections where id = (select v from pg_temp.ids where k = 'c1')$$,
  $$values (pg_temp.id(2), true)$$, 'the collection belongs to the caller and has a number (COL-06, COL-07)');
select results_eq($$select unit::text, quantity, loaves_per_unit_snapshot from public.collection_items
  where collection_id = (select v from pg_temp.ids where k = 'c1') order by loaves_per_unit_snapshot$$,
  $$values ('Loaf', 500, 1), ('Caisse', 10, 50)$$, 'PRD-06: the loaves per unit are frozen from the product at submit time');
select is((select count(*)::int from public.audit_log where action = 'collection_created'
  and record_id = (select v::text from pg_temp.ids where k = 'c1') and user_id = pg_temp.id(2)), 1,
  'AUD-03: collection created is logged against the caller');

select pg_temp.sign_in_as(pg_temp.id(2));
select pg_temp.refuses($$select public.submit_collection('[]'::jsonb)$$, 'INVALID_ITEMS', 'COL-03: at least one line');
select pg_temp.refuses($$select public.submit_collection('{"a":1}'::jsonb)$$, 'INVALID_ITEMS', 'lines must be a list');
select pg_temp.refuses($$select public.submit_collection('[{"product_id":"nope","unit":"Loaf","quantity":5}]'::jsonb)$$,
  'INVALID_ITEMS', 'a line the function cannot read is refused with a code, not a raw database message');
select pg_temp.refuses($$select pg_temp.collect1(20, 'Loaf', 0)$$, 'INVALID_QUANTITY', 'COL-05: zero is refused');
select pg_temp.refuses($$select pg_temp.collect1(20, 'Loaf', -4)$$, 'INVALID_QUANTITY', 'COL-05: a negative quantity is refused');
select pg_temp.refuses($$select public.submit_collection(jsonb_build_array(pg_temp.line(20, 'Loaf', 5), pg_temp.line(20, 'Loaf', 6)))$$,
  'DUPLICATE_LINE', 'COL-04: the same product and unit twice is refused');
select pg_temp.refuses($$select pg_temp.collect1(21, 'Pack', 5)$$, 'UNIT_NOT_SUPPORTED', 'COL-02: a unit the product does not support is refused');
select pg_temp.refuses($$select pg_temp.collect1(22, 'Loaf', 5)$$, 'PRODUCT_INACTIVE', 'an inactive product cannot be collected');
select pg_temp.refuses($$select pg_temp.collect1(99, 'Loaf', 5)$$, 'UNIT_NOT_SUPPORTED', 'an unknown product is refused');
select throws_ok($$insert into public.collections (distributor_id) values (pg_temp.id(2))$$, '42501', null,
  'SEC-2: a distributor cannot write the table directly');

select pg_temp.sign_in_as(pg_temp.id(1));
select pg_temp.refuses($$select pg_temp.collect1(20, 'Loaf', 5)$$, 'NOT_DISTRIBUTOR', 'an admin cannot submit a collection');
select pg_temp.sign_in_as(pg_temp.id(4));
select pg_temp.refuses($$select pg_temp.collect1(20, 'Loaf', 5)$$, 'NOT_DISTRIBUTOR', 'a depot manager cannot submit a collection');
reset role;
select is((select count(*)::int from public.collections), 1, 'none of the refused calls left a collection behind');

-- A second collection from Dist Two, for the "own collection only" check.
select pg_temp.sign_in_as(pg_temp.id(3));
select lives_ok($$select pg_temp.keep('c2', pg_temp.collect1(21, 'Loaf', 40))$$, 'another distributor submits their own collection');

-- ---------------------------------------------------------------------------
-- submit_distribution (DIS-01 to DIS-10)
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as(pg_temp.id(2));
select lives_ok($$select pg_temp.keep('d1', pg_temp.give('c1', 10,
  jsonb_build_array(pg_temp.line(20, 'Caisse', 3), pg_temp.line(20, 'Loaf', 100))))$$,
  'DIS-04: hands over 3 Caisses and 100 Loaves to Akwa');
reset role;
select results_eq($$select depot_id, distributor_id, label ~ '^DIS-[0-9]{5}$' from public.distributions
  where id = (select v from pg_temp.ids where k = 'd1')$$, $$values (pg_temp.id(10), pg_temp.id(2), true)$$,
  'the hand-over names the depot and the caller, and has a number');
select is((select status from public.v_receipt_status where distribution_id = (select v from pg_temp.ids where k = 'd1')),
  'awaiting_confirmation', 'DIS-08: the receipt starts Awaiting Confirmation');
select results_eq($$select unit::text, quantity, loaves_per_unit_snapshot from public.distribution_items
  where distribution_id = (select v from pg_temp.ids where k = 'd1') order by loaves_per_unit_snapshot$$,
  $$values ('Loaf', 100, 1), ('Caisse', 3, 50)$$, 'the lines carry the loaves per unit at submit time');
select is((select remaining_loaves::int from public.v_collection_product_balance
  where collection_id = (select v from pg_temp.ids where k = 'c1') and product_id = pg_temp.id(20)), 750,
  'REC-01: 250 of the 1,000 loaves are handed over; 750 remain');
select is((select count(*)::int from public.audit_log where action = 'distribution_submitted'
  and record_id = (select v::text from pg_temp.ids where k = 'd1') and user_id = pg_temp.id(2)), 1, 'AUD-03: the hand-over is logged');

select pg_temp.sign_in_as(pg_temp.id(2));
select lives_ok($$select pg_temp.keep('d2', pg_temp.give1('c1', 11, 20, 'Pack', 45))$$,
  'DIS-04: the unit may differ from the collected unit (45 Packs = 450 loaves)');
select pg_temp.refuses($$select pg_temp.give1('c1', 10, 20, 'Caisse', 7)$$,
  'OVER_DISTRIBUTION', 'DIS-06: 7 Caisses (350 loaves) is more than the 300 remaining');
select pg_temp.refuses($$select pg_temp.give('c1', 10, jsonb_build_array(pg_temp.line(20, 'Caisse', 3), pg_temp.line(20, 'Loaf', 151)))$$,
  'OVER_DISTRIBUTION', 'DIS-06: lines of one product are added together in loaves (301 > 300)');
select lives_ok($$select pg_temp.keep('d3', pg_temp.give1('c1', 10, 20, 'Loaf', 300))$$, 'DIS-06: exactly what remains is allowed');
select pg_temp.refuses($$select pg_temp.give1('c1', 10, 20, 'Loaf', 1)$$,
  'OVER_DISTRIBUTION', 'DIS-06: nothing more once the collection is fully handed over');

select pg_temp.refuses($$select pg_temp.give1('c2', 10, 21, 'Loaf', 5)$$, 'COLLECTION_NOT_FOUND', 'DIS-01: only the distributor''s own collection');
select pg_temp.refuses($$select pg_temp.give1('unknown', 10, 20, 'Loaf', 5)$$, 'COLLECTION_NOT_FOUND', 'an unknown collection');
select pg_temp.refuses($$select pg_temp.give1('c1', 12, 20, 'Loaf', 5)$$, 'DEPOT_INACTIVE', 'DIS-03: an inactive depot is refused');
select pg_temp.refuses($$select pg_temp.give1('c1', 98, 20, 'Loaf', 5)$$, 'DEPOT_INACTIVE', 'an unknown depot is refused');
select pg_temp.refuses($$select pg_temp.give1('c1', 10, 21, 'Loaf', 5)$$,
  'PRODUCT_NOT_IN_COLLECTION', 'a product that was not collected cannot be handed over');
select pg_temp.refuses($$select pg_temp.give1('c1', 10, 20, 'Loaf', 0)$$, 'INVALID_QUANTITY', 'DIS-05: a zero line is refused');
select pg_temp.refuses($$select pg_temp.give('c1', 10, '[]'::jsonb)$$, 'INVALID_ITEMS', 'DIS-05: at least one line');
select pg_temp.refuses($$select pg_temp.give('c1', 10, jsonb_build_array(pg_temp.line(20, 'Loaf', 1), pg_temp.line(20, 'Loaf', 1)))$$,
  'DUPLICATE_LINE', 'the same product and unit twice is refused');
select pg_temp.refuses($$select pg_temp.give1('c1', 10, 20, 'Loaf', 1)$$,
  'OVER_DISTRIBUTION', 'a refused call changed nothing: still nothing remains');
select pg_temp.sign_in_as(pg_temp.id(4));
select pg_temp.refuses($$select pg_temp.give1('c1', 10, 20, 'Loaf', 1)$$, 'NOT_DISTRIBUTOR', 'a depot manager cannot hand over bread');

select * from finish();
rollback;
