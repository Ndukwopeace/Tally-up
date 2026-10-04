-- -----------------------------------------------------------------------------
-- A3b database tests: the list views behind the Collections and Distributions screens.
--
-- WHY:  The admin lists show, per collection and per hand-over, who and where,
--       the status, and the quantities per unit as entered (ADM-02, ADM-03,
--       ADM-04). The views must give the same numbers as the balance views
--       (REC-01), use corrected values (COR-05), and show each role only its own
--       rows (ARCHITECTURE §6.5).
-- HOW:  pgTAP in one rolled-back transaction, with the spec's numbers: Big Bread,
--       1 Caisse = 50 loaves. 1,000 loaves collected (500 Loaves + 10 Caisse),
--       handed over as 3 Caisse + 100 Loaves to Akwa, 45 Packs to Bonaberi, and
--       300 Loaves to Akwa.
-- WHEN: scripts/db-test.sh (npm run db:test) and the CI `db-test` job.
-- SECURITY: Fictional users only; everything is rolled back.
-- -----------------------------------------------------------------------------
begin;
select plan(16);

create function pg_temp.id(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(to_hex(n), 12, '0'))::uuid
$$;
create function pg_temp.sign_in_as(uid uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;
create function pg_temp.count_of(statement text) returns int language plpgsql as $$
declare n int;
begin
  execute 'select count(*)::int from (' || statement || ') as rows' into n;
  return n;
end $$;
grant execute on function pg_temp.count_of(text) to authenticated;

insert into auth.users (id, email) select pg_temp.id(n), n || '@example.test' from generate_series(1, 5) as n;
insert into public.depots (id, name, location, address)
values (pg_temp.id(10), 'Akwa', 'Douala', 'Market'), (pg_temp.id(11), 'Bonaberi', 'Douala', 'Port');
insert into public.profiles (id, full_name, email, role, status, depot_id)
values (pg_temp.id(1), 'Admin', '1@example.test', 'admin', 'active', null),
       (pg_temp.id(2), 'Dist One', '2@example.test', 'distributor', 'active', null),
       (pg_temp.id(3), 'Dist Two', '3@example.test', 'distributor', 'active', null),
       (pg_temp.id(4), 'Mgr Akwa', '4@example.test', 'depot_manager', 'active', pg_temp.id(10)),
       (pg_temp.id(5), 'Mgr Bonaberi', '5@example.test', 'depot_manager', 'active', pg_temp.id(11));
insert into public.products (id, name, code, description) values (pg_temp.id(20), 'Big Bread', 'BB-01', 'Big loaf');

insert into public.collections (id, distributor_id) values (pg_temp.id(100), pg_temp.id(2)), (pg_temp.id(110), pg_temp.id(3));
insert into public.collection_items (id, collection_id, product_id, unit, quantity, loaves_per_unit_snapshot)
values (pg_temp.id(101), pg_temp.id(100), pg_temp.id(20), 'Loaf', 500, 1),
       (pg_temp.id(102), pg_temp.id(100), pg_temp.id(20), 'Caisse', 10, 50),
       (pg_temp.id(111), pg_temp.id(110), pg_temp.id(20), 'Loaf', 100, 1);
insert into public.distributions (id, collection_id, depot_id, distributor_id, created_at)
values (pg_temp.id(200), pg_temp.id(100), pg_temp.id(10), pg_temp.id(2), now() - interval '3 hours'),
       (pg_temp.id(210), pg_temp.id(100), pg_temp.id(11), pg_temp.id(2), now() - interval '2 hours'),
       (pg_temp.id(220), pg_temp.id(100), pg_temp.id(10), pg_temp.id(2), now() - interval '1 hour');
insert into public.distribution_items (id, distribution_id, product_id, unit, quantity, loaves_per_unit_snapshot)
values (pg_temp.id(201), pg_temp.id(200), pg_temp.id(20), 'Caisse', 3, 50),
       (pg_temp.id(202), pg_temp.id(200), pg_temp.id(20), 'Loaf', 100, 1),
       (pg_temp.id(211), pg_temp.id(210), pg_temp.id(20), 'Pack', 45, 10),
       (pg_temp.id(221), pg_temp.id(220), pg_temp.id(20), 'Loaf', 300, 1);
-- Akwa's first receipt: 95 Loaves counted against 100 (a discrepancy); Bonaberi's matches.
insert into public.confirmations (id, distribution_id, manager_id, comment)
values (pg_temp.id(300), pg_temp.id(200), pg_temp.id(4), 'Five crushed'), (pg_temp.id(310), pg_temp.id(210), pg_temp.id(5), null);
insert into public.confirmation_counts (confirmation_id, distribution_item_id, unit, quantity, loaves_per_unit_snapshot)
values (pg_temp.id(300), pg_temp.id(201), 'Caisse', 3, 50), (pg_temp.id(300), pg_temp.id(202), 'Loaf', 95, 1),
       (pg_temp.id(310), pg_temp.id(211), 'Pack', 45, 10);

-- ---------------------------------------------------------------------------
-- Collections list (ADM-03, ADM-04)
-- ---------------------------------------------------------------------------
-- Record numbers come from sequences, which a rolled-back test does not reset: check their shape, not the value.
select results_eq($$select label ~ '^COL-[0-9]{5}$', distributor_name, status from public.v_collection_list where id = pg_temp.id(100)$$,
  $$values (true, 'Dist One', 'fully_distributed')$$, 'ADM-03: number, distributor and status');
select is((select collected_by_unit from public.v_collection_list where id = pg_temp.id(100)),
  '[{"unit": "Loaf", "quantity": 500}, {"unit": "Caisse", "quantity": 10}]'::jsonb,
  'ADM-02: collected, per unit as entered');
select is((select distributed_by_unit from public.v_collection_list where id = pg_temp.id(100)),
  '[{"unit": "Loaf", "quantity": 400}, {"unit": "Pack", "quantity": 45}, {"unit": "Caisse", "quantity": 3}]'::jsonb,
  'ADM-02: distributed, per unit as entered (400 Loaves, 45 Packs, 3 Caisse)');
select is((select remaining_loaves::int from public.v_collection_list where id = pg_temp.id(100)), 0, 'REC-01: nothing remains');
select is((select remaining_loaves::int from public.v_collection_list where id = pg_temp.id(110)), 100,
  'REC-01: a collection with nothing handed over has everything remaining');
select is((select distributed_by_unit from public.v_collection_list where id = pg_temp.id(110)), '[]'::jsonb,
  'a collection with nothing handed over has no distributed units');
insert into public.corrections (target_table, target_id, field, original_value, corrected_value, admin_id)
values ('collection_items', pg_temp.id(102), 'quantity', '10', '11', pg_temp.id(1));
select is((select collected_by_unit from public.v_collection_list where id = pg_temp.id(100)),
  '[{"unit": "Loaf", "quantity": 500}, {"unit": "Caisse", "quantity": 11}]'::jsonb, 'COR-05: the list uses the corrected quantity');
select is((select status from public.v_collection_list where id = pg_temp.id(100)), 'in_progress',
  'COR-05: and the recomputed status (50 loaves remain)');

-- ---------------------------------------------------------------------------
-- Receipts list (ADM-04, RCP-11)
-- ---------------------------------------------------------------------------
select results_eq($$select label ~ '^DIS-[0-9]{5}$', collection_label = (select label from public.collections where id = pg_temp.id(100)),
  depot_name, distributor_name, status from public.v_receipt_list where id = pg_temp.id(200)$$,
  $$values (true, true, 'Akwa', 'Dist One', 'confirmed_with_discrepancy')$$,
  'a receipt shows its number, collection, depot, distributor and status');
select is((select recorded_by_unit from public.v_receipt_list where id = pg_temp.id(200)),
  '[{"unit": "Loaf", "quantity": 100}, {"unit": "Caisse", "quantity": 3}]'::jsonb, 'a receipt shows what was recorded, per unit');
select is((select status from public.v_receipt_list where id = pg_temp.id(220)), 'awaiting_confirmation',
  'a hand-over with no confirmation is Awaiting Confirmation');
select ok((select confirmed_at is null from public.v_receipt_list where id = pg_temp.id(220)), 'and has no confirmation time');

-- ---------------------------------------------------------------------------
-- Who can see which rows (ARCHITECTURE §6.5, SEC-12)
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as(pg_temp.id(1));
select is(pg_temp.count_of('select 1 from public.v_collection_list'), 2, 'an admin sees every collection');
select pg_temp.sign_in_as(pg_temp.id(2));
select is(pg_temp.count_of('select 1 from public.v_collection_list'), 1, 'a distributor sees only their own collections in the list');
select pg_temp.sign_in_as(pg_temp.id(5));
select is(pg_temp.count_of('select 1 from public.v_receipt_list'), 1, 'a depot manager sees only their own depot''s receipts in the list');
select is(pg_temp.count_of('select 1 from public.v_collection_list'), 0, 'and no collections');

select * from finish();
rollback;
