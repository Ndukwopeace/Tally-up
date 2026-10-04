-- -----------------------------------------------------------------------------
-- Staging test data, step 4: what the depot managers counted.
--
-- WHY:  The core question needs all three facts (REQUIREMENTS §1): collected,
--       handed over, counted. Here, 1 receipt in 6 has a discrepancy; the
--       hand-overs from the last 4 hours, and the 2 most recent ones that are
--       between 25 hours and 3 days old, are left Awaiting Confirmation (so the
--       24-hour flag, RCP-15, has something to show).
-- HOW:  A confirmation per confirmed hand-over, by that depot's demo manager, 2
--       hours after the hand-over. The count equals the recorded line, except:
--       one Big Bread line is one unit short (the discrepancy), and every 4th
--       receipt counts its Big Bread Caisse as one Caisse fewer plus the same
--       loaves in Packs (RCP-06, mixed units, still a match in loaves).
-- WHEN: Run in the STAGING SQL editor after 03, then 05.
-- SECURITY: Fictional. NEVER run on production (DB-5).
-- -----------------------------------------------------------------------------
create or replace function pg_temp.demo_id(kind int, n bigint) returns uuid language sql immutable as $$
  select ('de' || lpad(to_hex(kind), 6, '0') || '-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid
$$;

drop table if exists pg_temp.demo_receipts;
create temp table demo_receipts as
with ranked as (
  select d.*, row_number() over (order by d.created_at, d.id) as rn,
    row_number() over (partition by (d.created_at between now() - interval '3 days' and now() - interval '25 hours')
      order by d.created_at desc, d.id) as aged_rank,
    d.created_at between now() - interval '3 days' and now() - interval '25 hours' as is_aged
  from public.distributions d where d.id::text like 'de%'
)
select * from ranked
where created_at < now() - interval '4 hours' and not (is_aged and aged_rank <= 2);

insert into public.confirmations (id, distribution_id, manager_id, comment, confirmed_at)
select pg_temp.demo_id(8, r.rn), r.id, m.id,
  case when r.rn % 6 = 3 then 'Some crates arrived short' end, r.created_at + interval '2 hours'
from demo_receipts r
join public.profiles m on m.depot_id = r.depot_id and m.role = 'depot_manager' and m.id::text like 'de%';

insert into public.confirmation_counts (id, confirmation_id, distribution_item_id, unit, quantity, loaves_per_unit_snapshot)
select pg_temp.demo_id(9, row_number() over (order by di.id, x.part)), pg_temp.demo_id(8, r.rn), di.id, x.unit, x.qty, x.snap
from demo_receipts r
join public.distribution_items di on di.distribution_id = r.id
cross join lateral (
  select 1 as part, di.unit,
    case when r.rn % 6 = 3 and di.product_id = pg_temp.demo_id(2, 1) then di.quantity - 1
         when r.rn % 4 = 0 and r.rn % 6 <> 3 and di.unit = 'Caisse' and di.product_id = pg_temp.demo_id(2, 1) then di.quantity - 1
         else di.quantity end as qty,
    di.loaves_per_unit_snapshot as snap
  union all
  select 2, 'Pack'::public.product_unit, di.loaves_per_unit_snapshot / pk.loaves_per_unit, pk.loaves_per_unit
  from public.product_units pk
  where pk.product_id = di.product_id and pk.unit = 'Pack'
    and r.rn % 4 = 0 and r.rn % 6 <> 3 and di.unit = 'Caisse' and di.product_id = pg_temp.demo_id(2, 1)
) x
where exists (select 1 from public.confirmations cf where cf.id = pg_temp.demo_id(8, r.rn));

drop table demo_receipts;
