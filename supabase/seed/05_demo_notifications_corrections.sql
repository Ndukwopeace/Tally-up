-- -----------------------------------------------------------------------------
-- Staging test data, step 5: admin notifications and two corrections.
--
-- WHY:  The admin's bell shows one notification per discrepancy (NOT-04), and the
--       correction history needs something to show (COR-02, COR-04, Q-59b).
-- HOW:  Uses the first active admin (you). If there is none, nothing is added.
--       - A notification "Distribution discrepancy detected at <depot>." for each
--         receipt Confirmed with Discrepancy; those older than 2 days are read.
--       - Correction 1: the oldest discrepant receipt is recounted, raising the
--         short Big Bread count by one, so it now matches (COR-05).
--       - Correction 2: the newest In Progress collection gets one more Big Bread Caisse.
--       Original rows are never changed; the corrections sit beside them.
-- WHEN: Run in the STAGING SQL editor after 04. Last step.
-- SECURITY: Fictional. NEVER run on production (DB-5).
-- -----------------------------------------------------------------------------
create or replace function pg_temp.demo_id(kind int, n bigint) returns uuid language sql immutable as $$
  select ('de' || lpad(to_hex(kind), 6, '0') || '-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid
$$;

drop table if exists pg_temp.demo_admin;
create temp table demo_admin as
select id from public.profiles where role = 'admin' and status = 'active' order by created_at limit 1;

insert into public.notifications (id, user_id, type, record_type, record_id, message, read_at, created_at)
select pg_temp.demo_id(11, d.number), a.id, 'discrepancy', 'distribution', d.id::text,
  'Distribution discrepancy detected at ' || dp.name || '.',
  case when cf.confirmed_at < now() - interval '2 days' then cf.confirmed_at + interval '1 hour' end, cf.confirmed_at
from public.confirmations cf
join public.v_receipt_status rs on rs.distribution_id = cf.distribution_id and rs.status = 'confirmed_with_discrepancy'
join public.distributions d on d.id = cf.distribution_id
join public.depots dp on dp.id = d.depot_id
cross join demo_admin a
where cf.id::text like 'de%';

insert into public.corrections (id, target_table, target_id, field, original_value, corrected_value, admin_id, note, created_at)
select pg_temp.demo_id(10, 1), 'confirmation_counts', cc.id, 'quantity', cc.quantity::text, (cc.quantity + 1)::text,
  a.id, 'Depot manager recounted the crates', cf.confirmed_at + interval '1 day'
from (
  select cf.id, cf.confirmed_at from public.confirmations cf
  join public.v_receipt_status rs on rs.distribution_id = cf.distribution_id and rs.status = 'confirmed_with_discrepancy'
  where cf.id::text like 'de%' order by cf.confirmed_at limit 1
) cf
join public.confirmation_counts cc on cc.confirmation_id = cf.id
join public.distribution_items di on di.id = cc.distribution_item_id and di.product_id = pg_temp.demo_id(2, 1)
cross join demo_admin a
where cc.quantity < di.quantity;

insert into public.corrections (id, target_table, target_id, field, original_value, corrected_value, admin_id, note)
select pg_temp.demo_id(10, 2), 'collection_items', ci.id, 'quantity', ci.quantity::text, (ci.quantity + 1)::text,
  a.id, 'Bakery recounted the crates'
from (
  select c.id from public.collections c
  join public.v_collection_status s on s.collection_id = c.id and s.status = 'in_progress'
  where c.id::text like 'de%' order by c.created_at desc limit 1
) c
join public.collection_items ci on ci.collection_id = c.id and ci.product_id = pg_temp.demo_id(2, 1) and ci.unit = 'Caisse'
cross join demo_admin a;

drop table demo_admin;
