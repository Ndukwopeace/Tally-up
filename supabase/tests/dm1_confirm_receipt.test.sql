-- -----------------------------------------------------------------------------
-- DM1 database tests: confirm_receipt(), the only write path for a depot manager.
--
-- WHY:  The manager's count decides whether bread arrived. The rules: only their own
--       depot's receipts, every line counted by hand (RCP-04), counts in any unit the
--       product supports and several per line (RCP-05, RCP-06), zero allowed
--       (RCP-07), an optional comment (RCP-09), the system computes the status
--       (RCP-11), and it is locked once confirmed (RCP-12).
-- HOW:  pgTAP in one rolled-back transaction, with the spec's numbers: Big Bread
--       (1 Pack = 10, 1 Caisse = 50 loaves). Akwa was handed 3 Caisses and 100 Loaves
--       (250 loaves); Bonaberi 45 Packs.
-- WHEN: scripts/db-test.sh (npm run db:test) and the CI `db-test` job.
-- SECURITY: Fictional users only; everything is rolled back.
-- -----------------------------------------------------------------------------
begin;
select plan(28);

create function pg_temp.id(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(to_hex(n), 12, '0'))::uuid
$$;
create function pg_temp.sign_in_as(uid uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;
create temp table ids (k text primary key, v uuid);
grant all on pg_temp.ids to authenticated;

insert into auth.users (id, email) select pg_temp.id(n), n || '@example.test' from generate_series(1, 5) as n;
insert into public.depots (id, name, location, address)
values (pg_temp.id(10), 'Akwa', 'Douala', 'Market'), (pg_temp.id(11), 'Bonaberi', 'Douala', 'Port');
insert into public.profiles (id, full_name, email, role, status, depot_id)
values (pg_temp.id(1), 'Admin', '1@example.test', 'admin', 'active', null),
       (pg_temp.id(2), 'Dist One', '2@example.test', 'distributor', 'active', null),
       (pg_temp.id(4), 'Mgr Akwa', '4@example.test', 'depot_manager', 'active', pg_temp.id(10)),
       (pg_temp.id(5), 'Mgr Bonaberi', '5@example.test', 'depot_manager', 'active', pg_temp.id(11));
insert into public.products (id, name, code, description)
values (pg_temp.id(20), 'Big Bread', 'BB-01', 'Big'), (pg_temp.id(21), 'Small Bread', 'SB-01', 'Small');
insert into public.product_units (product_id, unit, loaves_per_unit)
values (pg_temp.id(20), 'Loaf', 1), (pg_temp.id(20), 'Pack', 10), (pg_temp.id(20), 'Caisse', 50),
       (pg_temp.id(21), 'Loaf', 1), (pg_temp.id(21), 'Caisse', 30);

insert into public.collections (id, distributor_id) values (pg_temp.id(100), pg_temp.id(2));
insert into public.collection_items (collection_id, product_id, unit, quantity, loaves_per_unit_snapshot)
values (pg_temp.id(100), pg_temp.id(20), 'Loaf', 1000, 1), (pg_temp.id(100), pg_temp.id(21), 'Loaf', 100, 1);
insert into public.distributions (id, collection_id, depot_id, distributor_id)
values (pg_temp.id(200), pg_temp.id(100), pg_temp.id(10), pg_temp.id(2)),
       (pg_temp.id(210), pg_temp.id(100), pg_temp.id(11), pg_temp.id(2)),
       (pg_temp.id(220), pg_temp.id(100), pg_temp.id(10), pg_temp.id(2)),
       (pg_temp.id(230), pg_temp.id(100), pg_temp.id(10), pg_temp.id(2));
insert into public.distribution_items (id, distribution_id, product_id, unit, quantity, loaves_per_unit_snapshot)
values (pg_temp.id(201), pg_temp.id(200), pg_temp.id(20), 'Caisse', 3, 50),
       (pg_temp.id(202), pg_temp.id(200), pg_temp.id(20), 'Loaf', 100, 1),
       (pg_temp.id(211), pg_temp.id(210), pg_temp.id(20), 'Pack', 45, 10),
       (pg_temp.id(221), pg_temp.id(220), pg_temp.id(20), 'Loaf', 300, 1),
       (pg_temp.id(231), pg_temp.id(230), pg_temp.id(20), 'Loaf', 10, 1),
       (pg_temp.id(232), pg_temp.id(230), pg_temp.id(21), 'Caisse', 2, 30);

-- ---------------------------------------------------------------------------
-- A confirmation with a difference: 2 Caisses + 5 Packs against 3 Caisses, 95 Loaves against 100
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as(pg_temp.id(4));
select lives_ok($$insert into pg_temp.ids values ('k1', public.confirm_receipt(pg_temp.id(200), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id(201), 'unit', 'Caisse', 'quantity', 2),
  jsonb_build_object('item_id', pg_temp.id(201), 'unit', 'Pack', 'quantity', 5),
  jsonb_build_object('item_id', pg_temp.id(202), 'unit', 'Loaf', 'quantity', 95)), 'Five crushed'))$$,
  'RCP-06: one line is counted in two units, and the receipt is confirmed');
reset role;
select is((select status from public.v_receipt_status where distribution_id = pg_temp.id(200)), 'confirmed_with_discrepancy',
  'RCP-11: the system computes the status: the Loaves line is 5 short');
select results_eq($$select distribution_item_id = pg_temp.id(201), difference_loaves::int from public.v_receipt_line
  where distribution_item_id in (pg_temp.id(201), pg_temp.id(202)) order by distribution_item_id$$,
  $$values (true, 0), (false, -5)$$, 'REC-02: the Caisse line matches in loaves (150), the Loaves line is -5');
select results_eq($$select manager_id, comment from public.confirmations where id = (select v from pg_temp.ids where k = 'k1')$$,
  $$values (pg_temp.id(4), 'Five crushed')$$, 'the confirmation names the caller and keeps the comment');
select results_eq($$select unit::text, quantity, loaves_per_unit_snapshot from public.confirmation_counts
  where confirmation_id = (select v from pg_temp.ids where k = 'k1') order by loaves_per_unit_snapshot, quantity$$,
  $$values ('Loaf', 95, 1), ('Pack', 5, 10), ('Caisse', 2, 50)$$, 'PRD-06: counts carry the loaves per unit at confirm time');
select is((select string_agg(action, ',' order by action) from public.audit_log
  where record_id = pg_temp.id(200)::text and user_id = pg_temp.id(4)), 'discrepancy_detected,receipt_confirmed',
  'AUD-03: the confirmation and the discrepancy are both logged');

-- ---------------------------------------------------------------------------
-- A match, a blank comment, and a zero count
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as(pg_temp.id(4));
select lives_ok($$select public.confirm_receipt(pg_temp.id(220), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id(221), 'unit', 'Loaf', 'quantity', 300)), '   ')$$, 'a matching count is confirmed');
select lives_ok($$select public.confirm_receipt(pg_temp.id(230), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id(231), 'unit', 'Loaf', 'quantity', 0),
  jsonb_build_object('item_id', pg_temp.id(232), 'unit', 'Caisse', 'quantity', 3)), null)$$,
  'RCP-07: zero is a valid count, and a count may exceed what was recorded');
reset role;
select is((select status from public.v_receipt_status where distribution_id = pg_temp.id(220)), 'confirmed',
  'RCP-11: every line matches in loaves, so it is Confirmed');
select is((select comment from public.confirmations where distribution_id = pg_temp.id(220)), null,
  'RCP-09: a blank comment is stored as no comment');
select is((select count(*)::int from public.audit_log where record_id = pg_temp.id(220)::text and action = 'discrepancy_detected'), 0,
  'no discrepancy is logged for a match');
select is((select status from public.v_receipt_status where distribution_id = pg_temp.id(230)), 'confirmed_with_discrepancy',
  'a zero count and an excess both differ from what was recorded');

-- ---------------------------------------------------------------------------
-- Refusals (nothing is saved when one happens)
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as(pg_temp.id(4));
select throws_ok($$select public.confirm_receipt(pg_temp.id(200), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id(201), 'unit', 'Caisse', 'quantity', 3),
  jsonb_build_object('item_id', pg_temp.id(202), 'unit', 'Loaf', 'quantity', 100)), null)$$,
  'P0001', 'ALREADY_CONFIRMED', 'RCP-12: a confirmed receipt cannot be confirmed again');
select pg_temp.sign_in_as(pg_temp.id(5));
select throws_ok($$select public.confirm_receipt(pg_temp.id(200), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id(201), 'unit', 'Caisse', 'quantity', 3)), null)$$,
  'P0001', 'RECEIPT_NOT_FOUND', 'RCP-01: another depot''s manager cannot reach the receipt');
select throws_ok($$select public.confirm_receipt(pg_temp.id(999), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id(201), 'unit', 'Caisse', 'quantity', 3)), null)$$,
  'P0001', 'RECEIPT_NOT_FOUND', 'an unknown receipt');
select throws_ok($$select public.confirm_receipt(pg_temp.id(210), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id(202), 'unit', 'Loaf', 'quantity', 1)), null)$$,
  'P0001', 'INVALID_ITEM', 'a count for a line of another receipt is refused');
select throws_ok($$select public.confirm_receipt(pg_temp.id(210), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id(211), 'unit', 'Pack', 'quantity', 45)), repeat('x', 1001))$$,
  'P0001', 'COMMENT_TOO_LONG', 'the comment is limited to 1,000 characters');
select throws_ok($$select public.confirm_receipt(pg_temp.id(210), '[]'::jsonb, null)$$,
  'P0001', 'INVALID_ITEMS', 'RCP-04: no counts at all is refused, never read as a match');
select throws_ok($$select public.confirm_receipt(pg_temp.id(210), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id(211), 'unit', 'Pack', 'quantity', -1)), null)$$,
  'P0001', 'INVALID_QUANTITY', 'a negative count is refused');
select throws_ok($$select public.confirm_receipt(pg_temp.id(210), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id(211), 'unit', 'Pack', 'quantity', 1),
  jsonb_build_object('item_id', pg_temp.id(211), 'unit', 'Pack', 'quantity', 2)), null)$$,
  'P0001', 'DUPLICATE_LINE', 'RCP-06: one entry per unit for each line');
select throws_ok($$select public.confirm_receipt(pg_temp.id(210), jsonb_build_array(
  jsonb_build_object('item_id', 'nope', 'unit', 'Pack', 'quantity', 1)), null)$$,
  'P0001', 'INVALID_ITEMS', 'an unreadable line gives a code, not a database message');
select is((select count(*)::int from public.confirmations where distribution_id = pg_temp.id(210)), 0,
  'the refused calls left nothing behind');

select pg_temp.sign_in_as(pg_temp.id(4));
-- A new receipt for the two-line checks (Akwa, Big Bread Loaf + Small Bread Caisse).
reset role;
insert into public.distributions (id, collection_id, depot_id, distributor_id)
values (pg_temp.id(240), pg_temp.id(100), pg_temp.id(10), pg_temp.id(2));
insert into public.distribution_items (id, distribution_id, product_id, unit, quantity, loaves_per_unit_snapshot)
values (pg_temp.id(241), pg_temp.id(240), pg_temp.id(20), 'Loaf', 10, 1),
       (pg_temp.id(242), pg_temp.id(240), pg_temp.id(21), 'Caisse', 2, 30);
select pg_temp.sign_in_as(pg_temp.id(4));
select throws_ok($$select public.confirm_receipt(pg_temp.id(240), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id(241), 'unit', 'Loaf', 'quantity', 10)), null)$$,
  'P0001', 'COUNT_MISSING', 'RCP-04: every line must be counted; the Small Bread line has no count');
select throws_ok($$select public.confirm_receipt(pg_temp.id(240), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id(241), 'unit', 'Loaf', 'quantity', 10),
  jsonb_build_object('item_id', pg_temp.id(242), 'unit', 'Pack', 'quantity', 2)), null)$$,
  'P0001', 'UNIT_NOT_SUPPORTED', 'RCP-05: Small Bread has no Pack');
select throws_ok($$insert into public.confirmations (distribution_id, manager_id) values (pg_temp.id(240), pg_temp.id(4))$$,
  '42501', null, 'SEC-2: a manager cannot write the table directly');

select pg_temp.sign_in_as(pg_temp.id(2));
select throws_ok($$select public.confirm_receipt(pg_temp.id(240), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id(241), 'unit', 'Loaf', 'quantity', 10)), null)$$,
  'P0001', 'NOT_DEPOT_MANAGER', 'DIS-12: a distributor cannot confirm a receipt');
select pg_temp.sign_in_as(pg_temp.id(1));
select throws_ok($$select public.confirm_receipt(pg_temp.id(240), jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.id(241), 'unit', 'Loaf', 'quantity', 10)), null)$$,
  'P0001', 'NOT_DEPOT_MANAGER', 'an admin cannot confirm a receipt (corrections are the admin''s tool)');
reset role;
select is((select count(*)::int from public.confirmations), 3, 'only the three good confirmations exist');

select * from finish();
rollback;
