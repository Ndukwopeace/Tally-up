-- -----------------------------------------------------------------------------
-- Staging test data, step 2: 14 days of collections (5 a day).
--
-- WHY:  The Home, Collections and Distributions screens need a realistic history
--       (Q-59b). Every day has 5 collections; today's are spread between
--       midnight and now (Douala time), so "Today" is never empty and never in the future.
-- HOW:  Collection n (1 to 70) belongs to distributor 1 or 2. Each has 3 lines:
--       Big, Small and Milk Bread in Caisses (k between 3 and 12), and Big Bread
--       also has 40 loose Loaves. Quantities are in the product's own Caisse size.
-- WHEN: Run in the STAGING SQL editor after 01, then 03 to 05.
-- SECURITY: Fictional. NEVER run on production (DB-5).
-- -----------------------------------------------------------------------------
create or replace function pg_temp.demo_id(kind int, n bigint) returns uuid language sql immutable as $$
  select ('de' || lpad(to_hex(kind), 6, '0') || '-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid
$$;

with today as (
  select date_trunc('day', now() at time zone 'Africa/Douala') at time zone 'Africa/Douala' as starts
), slots as (
  select d, i, d * 5 + i + 1 as n from generate_series(0, 13) as d, generate_series(0, 4) as i
)
insert into public.collections (id, distributor_id, created_at)
select pg_temp.demo_id(4, n), pg_temp.demo_id(3, 1 + n % 2),
  case when d = 0 then starts + (now() - starts) * ((i + 1) / 6.0)
       else starts - make_interval(days => d) + interval '6 hours' + i * interval '80 minutes' end
from slots cross join today;

-- One Caisse line per bread, plus 40 loose Loaves of Big Bread. The sizes depend on the
-- collection's place in date order, not on its number, so a reset rebuilds the same data.
insert into public.collection_items (id, collection_id, product_id, unit, quantity, loaves_per_unit_snapshot)
select pg_temp.demo_id(5, c.number * 10 + p), c.id, pg_temp.demo_id(2, p), 'Caisse',
  3 + (c.pos * (11 - 2 * p)) % 10,
  (select pu.loaves_per_unit from public.product_units pu where pu.product_id = pg_temp.demo_id(2, p) and pu.unit = 'Caisse')
from (
  select c.*, row_number() over (order by c.created_at, c.id) as pos
  from public.collections c where c.id::text like 'de%'
) c cross join generate_series(1, 3) as p;
insert into public.collection_items (id, collection_id, product_id, unit, quantity, loaves_per_unit_snapshot)
select pg_temp.demo_id(5, c.number * 10 + 4), c.id, pg_temp.demo_id(2, 1), 'Loaf', 40, 1
from public.collections c where c.id::text like 'de%';
