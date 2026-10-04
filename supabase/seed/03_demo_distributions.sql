-- -----------------------------------------------------------------------------
-- Staging test data, step 3: hand-overs (distributions) to the depots.
--
-- WHY:  Collections are split across depots (Q-59b). Most are fully handed over;
--       the 3 newest keep only their first hand-over, and some older ones (every
--       11th in date order, more than 25 hours old) stay In Progress, so the stale flag has
--       something to show (COL-11).
-- HOW:  Hand-over 1 gives half of each Caisse line (a whole number of Caisses) to
--       one depot. Hand-over 2 gives the rest to the next depot as Packs, plus
--       the 40 loose Loaves of Big Bread (DIS-04: the unit differs from the one
--       collected). Totals add up exactly, so nothing is ever over-distributed (DIS-06).
-- WHEN: Run in the STAGING SQL editor after 02, then 04 and 05.
-- SECURITY: Fictional. NEVER run on production (DB-5).
-- -----------------------------------------------------------------------------
create or replace function pg_temp.demo_id(kind int, n bigint) returns uuid language sql immutable as $$
  select ('de' || lpad(to_hex(kind), 6, '0') || '-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid
$$;

with demo as (
  select c.*, row_number() over (order by c.created_at desc, c.id) as recency
  from public.collections c where c.id::text like 'de%'
), partial as (
  select id from demo where recency <= 3 or (recency % 11 = 0 and created_at < now() - interval '25 hours')
)
insert into public.distributions (id, collection_id, depot_id, distributor_id, created_at)
select pg_temp.demo_id(6, c.number * 2 + seq), c.id, pg_temp.demo_id(1, 1 + (c.recency + seq - 1) % 3),
  c.distributor_id, least(c.created_at + seq * interval '25 minutes', now())
from demo c cross join generate_series(1, 2) as seq
where seq = 1 or c.id not in (select id from partial);

-- Hand-over 1: half of each Caisse line, in Caisses.
insert into public.distribution_items (id, distribution_id, product_id, unit, quantity, loaves_per_unit_snapshot)
select pg_temp.demo_id(7, c.number * 100 + 10 + p), pg_temp.demo_id(6, c.number * 2 + 1), ci.product_id, 'Caisse',
  ci.quantity / 2, ci.loaves_per_unit_snapshot
from public.collections c cross join generate_series(1, 3) as p
join public.collection_items ci on ci.id = pg_temp.demo_id(5, c.number * 10 + p)
where c.id::text like 'de%';

-- Hand-over 2 (where it exists): the rest as Packs, and the loose Big Bread Loaves.
insert into public.distribution_items (id, distribution_id, product_id, unit, quantity, loaves_per_unit_snapshot)
select pg_temp.demo_id(7, c.number * 100 + 20 + p), d.id, ci.product_id, 'Pack'::public.product_unit,
  (ci.quantity - ci.quantity / 2) * ci.loaves_per_unit_snapshot / pk.loaves_per_unit, pk.loaves_per_unit
from public.collections c cross join generate_series(1, 3) as p
join public.distributions d on d.id = pg_temp.demo_id(6, c.number * 2 + 2)
join public.collection_items ci on ci.id = pg_temp.demo_id(5, c.number * 10 + p)
join public.product_units pk on pk.product_id = ci.product_id and pk.unit = 'Pack'
where c.id::text like 'de%'
union all
select pg_temp.demo_id(7, c.number * 100 + 24), d.id, ci.product_id, 'Loaf'::public.product_unit, ci.quantity, 1
from public.collections c
join public.distributions d on d.id = pg_temp.demo_id(6, c.number * 2 + 2)
join public.collection_items ci on ci.id = pg_temp.demo_id(5, c.number * 10 + 4)
where c.id::text like 'de%';
