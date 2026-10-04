-- -----------------------------------------------------------------------------
-- Staging test data, step 0: remove the demo rows (and only the demo rows).
--
-- WHY:  The A3 screens are tested with realistic fictional data in the STAGING
--       database (Q-59b, DB-5). This file clears the previous demo data so the
--       other seed files can rebuild it around today's date.
-- HOW:  Every demo row has an id starting with "de" (see pg_temp.demo_id in the
--       other files). Deletes children before parents. Real rows are never touched.
-- WHEN: Run by hand in the STAGING SQL editor, before 01 to 05, whenever you want
--       fresh demo data. It is a clean-up of fictional rows by the database owner;
--       the app itself never deletes operational records (AUD-01).
-- SECURITY: NEVER run on production. These files are not in `migrations/`, so they
--       are never applied automatically.
-- -----------------------------------------------------------------------------
create or replace function pg_temp.is_demo(id uuid) returns boolean language sql immutable as $$
  select id::text like 'de%'
$$;

delete from public.notifications where pg_temp.is_demo(id);
delete from public.corrections where pg_temp.is_demo(id);
delete from public.confirmation_counts where pg_temp.is_demo(id);
delete from public.confirmations where pg_temp.is_demo(id);
delete from public.distribution_items where pg_temp.is_demo(id);
delete from public.distributions where pg_temp.is_demo(id);
delete from public.collection_items where pg_temp.is_demo(id);
delete from public.collections where pg_temp.is_demo(id);
delete from public.audit_log where pg_temp.is_demo(id);
delete from public.profiles where pg_temp.is_demo(id);
delete from auth.users where pg_temp.is_demo(id);
delete from public.product_units where pg_temp.is_demo(product_id);
delete from public.products where pg_temp.is_demo(id);
delete from public.depots where pg_temp.is_demo(id);
