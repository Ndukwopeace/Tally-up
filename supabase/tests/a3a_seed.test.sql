-- -----------------------------------------------------------------------------
-- A3a test of the staging test data (supabase/seed/).
--
-- WHY:  The A3 screens are judged on this data (Q-59b), so it must be consistent:
--       nothing over-distributed, every status present, today never empty, and
--       the reset must remove only the demo rows and rebuild the same data.
-- HOW:  Runs the real seed files inside one rolled-back transaction (\ir = path
--       relative to this file), then checks the data with the same views the
--       screens use. An admin and a non-demo depot are inserted first, to prove the
--       admin gets notifications and corrections, and that the reset leaves real rows.
-- WHEN: scripts/db-test.sh (npm run db:test) and the CI `db-test` job.
-- SECURITY: Fictional data only; everything is rolled back. The seed itself is
--       staging-only and is never in `migrations/` (DB-5).
-- -----------------------------------------------------------------------------
begin;
select plan(23);

insert into auth.users (id, email) values ('11111111-1111-4111-8111-111111111111', 'real.admin@example.test');
insert into public.profiles (id, full_name, email, role)
values ('11111111-1111-4111-8111-111111111111', 'Real Admin', 'real.admin@example.test', 'admin');
insert into public.depots (id, name, location, address)
values ('22222222-2222-4222-8222-222222222222', 'Real Depot', 'Douala', 'Somewhere');

\ir ../seed/00_reset_demo.sql
\ir ../seed/01_demo_master_data.sql
\ir ../seed/02_demo_collections.sql
\ir ../seed/03_demo_distributions.sql
\ir ../seed/04_demo_confirmations.sql
\ir ../seed/05_demo_notifications_corrections.sql

create function pg_temp.snapshot() returns text language sql as $$
  select concat_ws('/',
    (select count(*) from public.collections where id::text like 'de%'),
    (select count(*) from public.distributions where id::text like 'de%'),
    (select count(*) from public.confirmations where id::text like 'de%'),
    (select count(*) from public.confirmation_counts where id::text like 'de%'),
    (select count(*) from public.corrections where id::text like 'de%'),
    (select count(*) from public.notifications where id::text like 'de%'))
$$;
create temp table first_run as select pg_temp.snapshot() as shape;

-- People and master data
select is((select count(*)::int from public.depots where id::text like 'de%'), 3, 'Q-59b: the spec''s three depots');
select is((select count(*)::int from public.products where id::text like 'de%'), 3, 'Q-59b: Big, Small and Milk Bread');
select is((select count(*)::int from public.product_units where product_id::text like 'de%'), 9, 'every bread has Loaf, Pack and Caisse');
select is((select count(*)::int from public.profiles where id::text like 'de%' and role = 'distributor'), 2, 'Q-59b: two distributors');
select is((select count(*)::int from public.profiles where id::text like 'de%' and role = 'depot_manager' and status = 'active' and depot_id is not null), 3,
  'Q-59b: three depot managers, one per depot');
select is((select count(*)::int from auth.users where id::text like 'de%' and coalesce(encrypted_password, '') = ''), 5,
  'the demo accounts have no password, so they cannot sign in');
select is((select count(*)::int from public.profiles where id::text like 'de%' and email not like '%@demo.tallyup.test'), 0,
  'every demo email ends in @demo.tallyup.test');

-- History
select is((select count(*)::int from public.collections where id::text like 'de%'), 70, 'Q-59b: 14 days of 5 collections');
select is((select count(*)::int from public.collections where id::text like 'de%'
  and (created_at at time zone 'Africa/Douala')::date = (now() at time zone 'Africa/Douala')::date), 5,
  'NFR-10: five collections are dated today, Douala time');
select is((select count(*)::int from public.collections where created_at > now()), 0, 'no collection is dated in the future');
select is((select count(*)::int from public.distributions where created_at > now()), 0, 'no hand-over is dated in the future');

-- Consistency
select is((select count(*)::int from public.v_collection_product_balance where remaining_loaves < 0), 0,
  'DIS-06: nothing is over-distributed');
select ok((select count(*) from public.v_collection_status where status = 'fully_distributed') > 40, 'most collections are Fully Distributed');
select ok(exists (select 1 from public.collections c join public.v_collection_status s on s.collection_id = c.id
  where c.id::text like 'de%' and s.status = 'in_progress' and c.created_at < now() - interval '24 hours'),
  'COL-11: at least one collection is In Progress for more than 24 hours (stale)');
select ok(exists (select 1 from public.confirmation_counts cc join public.confirmation_counts cd
  on cd.confirmation_id = cc.confirmation_id and cd.distribution_item_id = cc.distribution_item_id and cd.unit <> cc.unit
  where cc.id::text like 'de%'), 'RCP-06: at least one line is counted in two units');

-- Receipt statuses
select ok(exists (select 1 from public.v_receipt_status s join public.distributions d on d.id = s.distribution_id
  where d.id::text like 'de%' and s.status = 'confirmed'), 'RCP-11: there are Confirmed receipts');
select ok((select count(*) from public.v_receipt_status s join public.distributions d on d.id = s.distribution_id
  where d.id::text like 'de%' and s.status = 'confirmed_with_discrepancy') between 5 and 25,
  'about 1 receipt in 6 is Confirmed with Discrepancy (after one was corrected)');
select ok((select count(*) from public.v_receipt_status s join public.distributions d on d.id = s.distribution_id
  where d.id::text like 'de%' and s.status = 'awaiting_confirmation' and d.created_at < now() - interval '24 hours') >= 1,
  'RCP-15: some receipts have been Awaiting Confirmation for more than 24 hours');
select ok((select count(*) from public.v_receipt_status s join public.distributions d on d.id = s.distribution_id
  where d.id::text like 'de%' and s.status = 'awaiting_confirmation' and d.created_at >= now() - interval '24 hours') >= 1,
  'some recent receipts are still Awaiting Confirmation');

-- Admin side
select ok((select count(*) from public.notifications where id::text like 'de%' and user_id = '11111111-1111-4111-8111-111111111111') >= 5,
  'NOT-04: the admin has a notification for each discrepancy');
select is((select count(*)::int from public.corrections where id::text like 'de%'), 2, 'COR-02: two corrections, beside the originals');

-- Reset: only demo rows go, and the same data comes back
\ir ../seed/00_reset_demo.sql
select is((select count(*)::int from public.depots where id = '22222222-2222-4222-8222-222222222222'), 1, 'the reset leaves real rows alone');
\ir ../seed/01_demo_master_data.sql
\ir ../seed/02_demo_collections.sql
\ir ../seed/03_demo_distributions.sql
\ir ../seed/04_demo_confirmations.sql
\ir ../seed/05_demo_notifications_corrections.sql
select is(pg_temp.snapshot(), (select shape from first_run), 'the reset and a second run rebuild the same data');

select * from finish();
rollback;
