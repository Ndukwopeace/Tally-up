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

-- Test helpers. They keep each check to one short line and add no rule of their own.
-- One counted line: the distribution item number, unit, quantity.
create function pg_temp.cnt(item int, u text, q numeric) returns jsonb language sql as $$
  select jsonb_build_object('item_id', pg_temp.id(item), 'unit', u, 'quantity', q)
$$;
-- Confirm a receipt (distribution number) with the given counts and comment.
create function pg_temp.confirm(dist int, counts jsonb, note text default null) returns uuid language sql as $$
  select public.confirm_receipt(pg_temp.id(dist), counts, note)
$$;
-- Confirm a receipt with a single counted line.
create function pg_temp.confirm1(dist int, item int, u text, q numeric, note text default null) returns uuid language sql as $$
  select pg_temp.confirm(dist, jsonb_build_array(pg_temp.cnt(item, u, q)), note)
$$;
-- The call must be refused with this code (every refusal is P0001 plus a plain code).
create function pg_temp.refuses(call text, code text, why text) returns text language sql as $$
  select throws_ok(call, 'P0001', code, why)
$$;
grant execute on all functions in schema pg_temp to authenticated;

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
select lives_ok($$insert into pg_temp.ids values ('k1', pg_temp.confirm(200, jsonb_build_array(
  pg_temp.cnt(201, 'Caisse', 2), pg_temp.cnt(201, 'Pack', 5), pg_temp.cnt(202, 'Loaf', 95)), 'Five crushed'))$$,
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
select lives_ok($$select pg_temp.confirm1(220, 221, 'Loaf', 300, '   ')$$, 'a matching count is confirmed');
select lives_ok($$select pg_temp.confirm(230, jsonb_build_array(pg_temp.cnt(231, 'Loaf', 0), pg_temp.cnt(232, 'Caisse', 3)))$$,
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
select pg_temp.refuses($$select pg_temp.confirm(200, jsonb_build_array(pg_temp.cnt(201, 'Caisse', 3), pg_temp.cnt(202, 'Loaf', 100)))$$,
  'ALREADY_CONFIRMED', 'RCP-12: a confirmed receipt cannot be confirmed again');
select pg_temp.sign_in_as(pg_temp.id(5));
select pg_temp.refuses($$select pg_temp.confirm1(200, 201, 'Caisse', 3)$$,
  'RECEIPT_NOT_FOUND', 'RCP-01: another depot''s manager cannot reach the receipt');
select pg_temp.refuses($$select pg_temp.confirm1(999, 201, 'Caisse', 3)$$, 'RECEIPT_NOT_FOUND', 'an unknown receipt');
select pg_temp.refuses($$select pg_temp.confirm1(210, 202, 'Loaf', 1)$$, 'INVALID_ITEM', 'a count for a line of another receipt is refused');
select pg_temp.refuses($$select pg_temp.confirm1(210, 211, 'Pack', 45, repeat('x', 1001))$$,
  'COMMENT_TOO_LONG', 'the comment is limited to 1,000 characters');
select pg_temp.refuses($$select pg_temp.confirm(210, '[]'::jsonb)$$, 'INVALID_ITEMS', 'RCP-04: no counts at all is refused, never read as a match');
select pg_temp.refuses($$select pg_temp.confirm1(210, 211, 'Pack', -1)$$, 'INVALID_QUANTITY', 'a negative count is refused');
select pg_temp.refuses($$select pg_temp.confirm(210, jsonb_build_array(pg_temp.cnt(211, 'Pack', 1), pg_temp.cnt(211, 'Pack', 2)))$$,
  'DUPLICATE_LINE', 'RCP-06: one entry per unit for each line');
select pg_temp.refuses($$select public.confirm_receipt(pg_temp.id(210),
  '[{"item_id":"nope","unit":"Pack","quantity":1}]'::jsonb, null)$$, 'INVALID_ITEMS', 'an unreadable line gives a code, not a database message');
select is((select count(*)::int from public.confirmations where distribution_id = pg_temp.id(210)), 0,
  'the refused calls left nothing behind');

-- A new receipt for the two-line checks (Akwa, Big Bread Loaf + Small Bread Caisse).
reset role;
insert into public.distributions (id, collection_id, depot_id, distributor_id)
values (pg_temp.id(240), pg_temp.id(100), pg_temp.id(10), pg_temp.id(2));
insert into public.distribution_items (id, distribution_id, product_id, unit, quantity, loaves_per_unit_snapshot)
values (pg_temp.id(241), pg_temp.id(240), pg_temp.id(20), 'Loaf', 10, 1),
       (pg_temp.id(242), pg_temp.id(240), pg_temp.id(21), 'Caisse', 2, 30);
select pg_temp.sign_in_as(pg_temp.id(4));
select pg_temp.refuses($$select pg_temp.confirm1(240, 241, 'Loaf', 10)$$,
  'COUNT_MISSING', 'RCP-04: every line must be counted; the Small Bread line has no count');
select pg_temp.refuses($$select pg_temp.confirm(240, jsonb_build_array(pg_temp.cnt(241, 'Loaf', 10), pg_temp.cnt(242, 'Pack', 2)))$$,
  'UNIT_NOT_SUPPORTED', 'RCP-05: Small Bread has no Pack');
select throws_ok($$insert into public.confirmations (distribution_id, manager_id) values (pg_temp.id(240), pg_temp.id(4))$$,
  '42501', null, 'SEC-2: a manager cannot write the table directly');

select pg_temp.sign_in_as(pg_temp.id(2));
select pg_temp.refuses($$select pg_temp.confirm1(240, 241, 'Loaf', 10)$$, 'NOT_DEPOT_MANAGER', 'DIS-12: a distributor cannot confirm a receipt');
select pg_temp.sign_in_as(pg_temp.id(1));
select pg_temp.refuses($$select pg_temp.confirm1(240, 241, 'Loaf', 10)$$,
  'NOT_DEPOT_MANAGER', 'an admin cannot confirm a receipt (corrections are the admin''s tool)');
reset role;
select is((select count(*)::int from public.confirmations), 3, 'only the three good confirmations exist');

select * from finish();
rollback;
