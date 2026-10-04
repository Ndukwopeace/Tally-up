-- -----------------------------------------------------------------------------
-- A3a database tests: collections, distributions, confirmations, corrections,
-- notifications, and the views that compute balances and statuses.
--
-- WHY:  These tables hold the three facts the whole system compares (what was
--       collected, what was handed over, what the depot counted). The database
--       must keep them append-only (AUD-01, REC-03), compute Remaining and both
--       statuses in loaves (REC-01, REC-02, COL-08, RCP-11), apply corrections
--       without overwriting (COR-02, COR-05), and show each role only its own
--       records (ARCHITECTURE §6.5, AUTH-10, SEC-12).
-- HOW:  pgTAP in one rolled-back transaction. Fixtures are inserted as the
--       database owner (the app has no write path to these tables until D1/DM1);
--       callers "sign in" by setting the JWT claims and switching role. The
--       numbers follow the spec: Big Bread, 1 Pack = 10 Loaves, 1 Caisse = 50.
-- WHEN: scripts/db-test.sh (npm run db:test) and the CI `db-test` job.
-- SECURITY: Fictional users only; everything is rolled back.
-- -----------------------------------------------------------------------------
begin;
select plan(57);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function pg_temp.id(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(to_hex(n), 12, '0'))::uuid
$$;

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
create function pg_temp.count_of(statement text) returns int language plpgsql as $$
declare n int;
begin
  execute 'select count(*)::int from (' || statement || ') as rows' into n;
  return n;
end $$;
grant execute on function pg_temp.count_of(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures (ids: 1 admin, 2-3 distributors, 4-5 managers, 10-11 depots, 20 product)
-- ---------------------------------------------------------------------------
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

-- Collection 1 (distributor one): 500 Loaves + 10 Caisse = 1,000 loaves.
insert into public.collections (id, distributor_id) values (pg_temp.id(100), pg_temp.id(2));
insert into public.collection_items (id, collection_id, product_id, unit, quantity, loaves_per_unit_snapshot)
values (pg_temp.id(101), pg_temp.id(100), pg_temp.id(20), 'Loaf', 500, 1),
       (pg_temp.id(102), pg_temp.id(100), pg_temp.id(20), 'Caisse', 10, 50);
-- Collection 2 (distributor two): 100 Loaves.
insert into public.collections (id, distributor_id) values (pg_temp.id(110), pg_temp.id(3));
insert into public.collection_items (id, collection_id, product_id, unit, quantity, loaves_per_unit_snapshot)
values (pg_temp.id(111), pg_temp.id(110), pg_temp.id(20), 'Loaf', 100, 1);

-- Distribution 1 to Akwa: 3 Caisse (150) + 100 Loaves. Distribution 2 to Bonaberi: 45 Packs (450).
insert into public.distributions (id, collection_id, depot_id, distributor_id)
values (pg_temp.id(200), pg_temp.id(100), pg_temp.id(10), pg_temp.id(2)),
       (pg_temp.id(210), pg_temp.id(100), pg_temp.id(11), pg_temp.id(2));
insert into public.distribution_items (id, distribution_id, product_id, unit, quantity, loaves_per_unit_snapshot)
values (pg_temp.id(201), pg_temp.id(200), pg_temp.id(20), 'Caisse', 3, 50),
       (pg_temp.id(202), pg_temp.id(200), pg_temp.id(20), 'Loaf', 100, 1),
       (pg_temp.id(211), pg_temp.id(210), pg_temp.id(20), 'Pack', 45, 10);

-- ---------------------------------------------------------------------------
-- Numbers and data rules
-- ---------------------------------------------------------------------------
select is((select label from public.collections where id = pg_temp.id(100)), 'COL-00001',
  'REQUIREMENTS §11: the first collection is COL-00001');
select is((select label from public.collections where id = pg_temp.id(110)), 'COL-00002', 'collection numbers count up globally');
select is((select label from public.distributions where id = pg_temp.id(200)), 'DIS-00001', 'the first hand-over is DIS-00001 (Q-39)');
select is((select label from public.distributions where id = pg_temp.id(210)), 'DIS-00002', 'hand-over numbers count up globally');
select throws_ok($$insert into public.collection_items (collection_id, product_id, unit, quantity, loaves_per_unit_snapshot)
  values (pg_temp.id(100), pg_temp.id(20), 'Pack', 0, 10)$$, '23514', null, 'COL-05: a quantity must be greater than zero');
select throws_ok($$insert into public.collection_items (collection_id, product_id, unit, quantity, loaves_per_unit_snapshot)
  values (pg_temp.id(100), pg_temp.id(20), 'Loaf', 5, 1)$$, '23505', null, 'COL-04: the same product and unit twice is blocked');
select throws_ok($$insert into public.distribution_items (distribution_id, product_id, unit, quantity, loaves_per_unit_snapshot)
  values (pg_temp.id(200), pg_temp.id(20), 'Loaf', 1, 1)$$, '23505', null, 'DIS-04: the same product and unit twice in one hand-over is blocked');
select throws_ok($$insert into public.distribution_items (distribution_id, product_id, unit, quantity, loaves_per_unit_snapshot)
  values (pg_temp.id(200), pg_temp.id(20), 'Pack', 1, 0)$$, '23514', null, 'PRD-06: the loaves-per-unit snapshot must be at least 1');

-- ---------------------------------------------------------------------------
-- Balance and collection status in loaves (REC-01, COL-08)
-- ---------------------------------------------------------------------------
select results_eq($$select collected_loaves::int, distributed_loaves::int, remaining_loaves::int
  from public.v_collection_product_balance where collection_id = pg_temp.id(100)$$,
  $$values (1000, 700, 300)$$, 'REC-01: Collected = Distributed + Remaining, in loaves (1,000 = 700 + 300)');
select is((select status from public.v_collection_status where collection_id = pg_temp.id(100)), 'in_progress',
  'COL-08: Remaining above zero means In Progress');
select results_eq($$select remaining_loaves::int from public.v_collection_product_balance where collection_id = pg_temp.id(110)$$,
  $$values (100)$$, 'a collection with nothing handed over has everything remaining');

insert into public.distributions (id, collection_id, depot_id, distributor_id)
values (pg_temp.id(220), pg_temp.id(100), pg_temp.id(10), pg_temp.id(2));
insert into public.distribution_items (id, distribution_id, product_id, unit, quantity, loaves_per_unit_snapshot)
values (pg_temp.id(221), pg_temp.id(220), pg_temp.id(20), 'Loaf', 300, 1);
select is((select status from public.v_collection_status where collection_id = pg_temp.id(100)), 'fully_distributed',
  'COL-08: Remaining of zero means Fully Distributed');

-- ---------------------------------------------------------------------------
-- Receipts: lines, differences and status in loaves (REC-02, RCP-06, RCP-11)
-- ---------------------------------------------------------------------------
select is((select status from public.v_receipt_status where distribution_id = pg_temp.id(200)), 'awaiting_confirmation',
  'RCP-11: a hand-over with no confirmation is Awaiting Confirmation');

-- Akwa's manager counts 2 Caisse + 5 Packs (150 loaves, a mix of units) and 95 Loaves (5 short).
insert into public.confirmations (id, distribution_id, manager_id, comment)
values (pg_temp.id(300), pg_temp.id(200), pg_temp.id(4), 'Five loaves were crushed');
insert into public.confirmation_counts (id, confirmation_id, distribution_item_id, unit, quantity, loaves_per_unit_snapshot)
values (pg_temp.id(301), pg_temp.id(300), pg_temp.id(201), 'Caisse', 2, 50),
       (pg_temp.id(302), pg_temp.id(300), pg_temp.id(201), 'Pack', 5, 10),
       (pg_temp.id(303), pg_temp.id(300), pg_temp.id(202), 'Loaf', 95, 1);
select results_eq($$select recorded_loaves::int, counted_loaves::int, difference_loaves::int
  from public.v_receipt_line where distribution_item_id = pg_temp.id(201)$$, $$values (150, 150, 0)$$,
  'RCP-06 / REC-02: 2 Caisse + 5 Packs match 3 Caisse recorded (difference 0 loaves)');
select results_eq($$select recorded_loaves::int, counted_loaves::int, difference_loaves::int
  from public.v_receipt_line where distribution_item_id = pg_temp.id(202)$$, $$values (100, 95, -5)$$,
  'REC-02: Difference = Confirmed - Recorded (95 - 100 = -5 loaves)');
select is((select status from public.v_receipt_status where distribution_id = pg_temp.id(200)), 'confirmed_with_discrepancy',
  'RCP-11: any line that differs makes it Confirmed with Discrepancy');

-- Bonaberi's manager counts 45 Packs exactly.
insert into public.confirmations (id, distribution_id, manager_id) values (pg_temp.id(310), pg_temp.id(210), pg_temp.id(5));
insert into public.confirmation_counts (confirmation_id, distribution_item_id, unit, quantity, loaves_per_unit_snapshot)
values (pg_temp.id(310), pg_temp.id(211), 'Pack', 45, 10);
select is((select status from public.v_receipt_status where distribution_id = pg_temp.id(210)), 'confirmed',
  'RCP-11: every line matching means Confirmed');
select is((select status from public.v_receipt_status where distribution_id = pg_temp.id(220)), 'awaiting_confirmation',
  'REC-05: a Fully Distributed collection can still have a receipt that is Awaiting Confirmation');
select throws_ok($$insert into public.confirmations (distribution_id, manager_id) values (pg_temp.id(200), pg_temp.id(4))$$,
  '23505', null, 'RCP-12: a receipt is confirmed once');
select lives_ok($$insert into public.confirmation_counts (confirmation_id, distribution_item_id, unit, quantity, loaves_per_unit_snapshot)
  values (pg_temp.id(310), pg_temp.id(211), 'Loaf', 0, 1)$$, 'RCP-07: a count of zero is allowed');
select throws_ok($$insert into public.confirmation_counts (confirmation_id, distribution_item_id, unit, quantity, loaves_per_unit_snapshot)
  values (pg_temp.id(310), pg_temp.id(211), 'Caisse', -1, 50)$$, '23514', null, 'RCP-07: a count cannot be negative');

-- ---------------------------------------------------------------------------
-- Corrections never overwrite; statuses recompute (COR-02, COR-04, COR-05)
-- ---------------------------------------------------------------------------
insert into public.corrections (target_table, target_id, field, original_value, corrected_value, admin_id, note, created_at)
values ('collection_items', pg_temp.id(102), 'quantity', '10', '11', pg_temp.id(1), 'Miscounted at the bakery', now() - interval '2 minutes');
select is((select quantity from public.collection_items where id = pg_temp.id(102)), 10,
  'COR-02: the original collection line is never changed');
select results_eq($$select quantity_effective, is_corrected from public.v_collection_items_effective where id = pg_temp.id(102)$$,
  $$values (11, true)$$, 'COR-04: the corrected quantity is used, and marked as corrected');
select results_eq($$select collected_loaves::int, remaining_loaves::int from public.v_collection_product_balance
  where collection_id = pg_temp.id(100)$$, $$values (1050, 50)$$, 'COR-05: balances recompute from corrected values');
select is((select status from public.v_collection_status where collection_id = pg_temp.id(100)), 'in_progress',
  'COR-05: the collection is In Progress again after the correction');
insert into public.corrections (target_table, target_id, field, original_value, corrected_value, admin_id, created_at)
values ('collection_items', pg_temp.id(102), 'quantity', '11', '10', pg_temp.id(1), now());
select results_eq($$select quantity_effective from public.v_collection_items_effective where id = pg_temp.id(102)$$, $$values (10)$$,
  'COR-02: the latest correction wins; the earlier one stays in the history');
select is((select count(*)::int from public.corrections where target_id = pg_temp.id(102)), 2,
  'COR-02: every correction is kept');

insert into public.corrections (target_table, target_id, field, original_value, corrected_value, admin_id)
values ('confirmation_counts', pg_temp.id(303), 'quantity', '95', '100', pg_temp.id(1));
select is((select status from public.v_receipt_status where distribution_id = pg_temp.id(200)), 'confirmed',
  'COR-05: correcting the count to 100 makes the receipt Confirmed');
select results_eq($$select recorded_loaves::int, counted_loaves::int, difference_loaves::int
  from public.v_receipt_line where distribution_item_id = pg_temp.id(202)$$, $$values (100, 100, 0)$$,
  'COR-05: the line difference recomputes');
select is((select count(*)::int from public.confirmation_counts where id = pg_temp.id(303) and quantity = 95), 1,
  'REC-03 / COR-02: the manager''s original count is untouched');
select throws_ok($$insert into public.corrections (target_table, target_id, field, original_value, corrected_value, admin_id)
  values ('profiles', pg_temp.id(1), 'role', 'admin', 'distributor', pg_temp.id(1))$$, '23514', null,
  'COR-01: only collection lines, distribution lines, confirmation counts and comments can be corrected');

-- ---------------------------------------------------------------------------
-- Notifications (NOT-05)
-- ---------------------------------------------------------------------------
insert into public.notifications (user_id, type, record_type, record_id, message)
values (pg_temp.id(1), 'discrepancy', 'distribution', pg_temp.id(200)::text, 'Distribution discrepancy detected at Akwa.'),
       (pg_temp.id(2), 'receipt_confirmed', 'distribution', pg_temp.id(200)::text, 'Akwa confirmed your distribution.');
select is((select read_at from public.notifications where user_id = pg_temp.id(1)), null, 'NOT-05: a new notification is unread');

-- ---------------------------------------------------------------------------
-- Who can see what (ARCHITECTURE §6.5, AUTH-10, SEC-12)
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as(pg_temp.id(1));
select is(pg_temp.count_of('select 1 from public.collections'), 2, 'an admin sees every collection');
select is(pg_temp.count_of('select 1 from public.distributions'), 3, 'an admin sees every distribution');
select is(pg_temp.count_of('select 1 from public.corrections'), 3, 'an admin reads the corrections');
select is(pg_temp.count_of('select 1 from public.notifications'), 1, 'NOT-05: even an admin reads only their own notifications');

select pg_temp.sign_in_as(pg_temp.id(2));
select is(pg_temp.count_of('select 1 from public.collections'), 1, 'a distributor sees only their own collections');
select is(pg_temp.count_of('select 1 from public.collection_items'), 2, 'a distributor sees the lines of their own collections only');
select is(pg_temp.count_of('select 1 from public.distributions'), 3, 'a distributor sees the hand-overs from their own collections');
select is(pg_temp.count_of('select 1 from public.confirmations'), 2, 'a distributor sees the confirmations of their own hand-overs');
select is(pg_temp.count_of('select 1 from public.v_collection_status'), 1, 'views follow the same rule (security invoker)');
select is(pg_temp.count_of('select 1 from public.corrections'), 3, '§6.5: a distributor reads the corrections to their own records');

select pg_temp.sign_in_as(pg_temp.id(3));
select is(pg_temp.count_of('select 1 from public.distributions'), 0, 'another distributor sees none of those hand-overs');
select is(pg_temp.count_of('select 1 from public.corrections'), 0, 'and none of the corrections to them');

select pg_temp.sign_in_as(pg_temp.id(4));
select is(pg_temp.count_of('select 1 from public.collections'), 0, 'a depot manager sees no collections');
select is(pg_temp.count_of('select 1 from public.distributions'), 2, 'a depot manager sees only their own depot''s hand-overs');
select is(pg_temp.count_of('select 1 from public.distribution_items'), 3, 'and only those hand-overs'' lines');
select is(pg_temp.count_of('select 1 from public.v_receipt_status'), 2, 'views follow the same rule for managers');
select is(pg_temp.count_of('select 1 from public.corrections'), 1, '§6.5: a manager reads the corrections to their own depot''s counts only');

select pg_temp.sign_in_as(pg_temp.id(5));
select is(pg_temp.count_of('select 1 from public.distributions'), 1, 'the other depot''s manager sees only theirs');

select pg_temp.sign_in_as(null);
select pg_temp.refused('select count(*) from public.collections', 'signed-out visitors read no collections');
select pg_temp.refused('select count(*) from public.v_receipt_status', 'signed-out visitors read no views');

-- ---------------------------------------------------------------------------
-- No writes through the API (AUD-01, ARCHITECTURE §6.1)
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as(pg_temp.id(1));
select pg_temp.refused($$insert into public.collections (distributor_id) values (pg_temp.id(2))$$, 'AUD-01: even an admin cannot insert a collection directly');
select pg_temp.refused($$update public.collection_items set quantity = 1$$, 'COR-02: nobody updates a collection line directly');
select pg_temp.refused($$delete from public.distributions$$, 'AUD-01: no hard delete of distributions');
select pg_temp.refused($$insert into public.corrections (target_table, target_id, field, original_value, corrected_value, admin_id)
  values ('collection_items', pg_temp.id(101), 'quantity', '500', '1', pg_temp.id(1))$$, 'a correction is written only by a database function (A3c)');
select pg_temp.refused($$update public.notifications set read_at = now()$$, 'notifications are marked read only by a database function (A3c)');

select * from finish();
rollback;
