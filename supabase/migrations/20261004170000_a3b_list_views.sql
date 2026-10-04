-- -----------------------------------------------------------------------------
-- A3b (admin lists), part 1 of 1: list views for Collections and Distributions.
--
-- WHY:  The admin lists show, per collection and per hand-over, who and where,
--       the status, and the quantities per unit as entered (ADM-02, ADM-03,
--       ADM-04, Q-59g). One view per list keeps the screens simple: they read
--       rows already put together, filter them and page through them.
-- HOW:  - v_collection_list: number, distributor, status (COL-08), collected and
--         distributed per unit as entered (jsonb arrays, Loaf, Pack, Caisse
--         order), and the loaves remaining (REC-01).
--       - v_receipt_list: number, collection, depot, distributor, receipt status
--         (RCP-11), confirmation time, and the quantities recorded per unit.
--         The collection, depot and distributor are left joins: a depot manager
--         cannot read collections, and still sees their depot's receipts.
--       All quantities use corrected values (COR-05).
-- WHEN: Run once per project, after the A3a files.
-- SECURITY: security_invoker views: Row Level Security of the tables underneath
--       applies, so each role sees only its own rows (§6.5). No access when signed out.
-- -----------------------------------------------------------------------------
create view public.v_collection_list with (security_invoker = true) as
select c.id, c.number, c.label, c.created_at, c.distributor_id,
  p.full_name as distributor_name,
  s.status,
  coalesce((
    select jsonb_agg(jsonb_build_object('unit', t.unit, 'quantity', t.quantity) order by t.unit)
    from (select unit, sum(quantity_effective)::int as quantity
          from public.v_collection_items_effective where collection_id = c.id group by unit) t
  ), '[]'::jsonb) as collected_by_unit,
  coalesce((
    select jsonb_agg(jsonb_build_object('unit', t.unit, 'quantity', t.quantity) order by t.unit)
    from (select di.unit, sum(di.quantity_effective)::int as quantity
          from public.v_distribution_items_effective di
          join public.distributions d on d.id = di.distribution_id
          where d.collection_id = c.id group by di.unit) t
  ), '[]'::jsonb) as distributed_by_unit,
  coalesce((select sum(b.remaining_loaves) from public.v_collection_product_balance b where b.collection_id = c.id), 0)
    as remaining_loaves
from public.collections c
left join public.profiles p on p.id = c.distributor_id
join public.v_collection_status s on s.collection_id = c.id;

create view public.v_receipt_list with (security_invoker = true) as
select d.id, d.number, d.label, d.created_at, d.collection_id, c.label as collection_label,
  d.depot_id, dp.name as depot_name, d.distributor_id, p.full_name as distributor_name,
  s.status, cf.confirmed_at,
  coalesce((
    select jsonb_agg(jsonb_build_object('unit', t.unit, 'quantity', t.quantity) order by t.unit)
    from (select unit, sum(quantity_effective)::int as quantity
          from public.v_distribution_items_effective where distribution_id = d.id group by unit) t
  ), '[]'::jsonb) as recorded_by_unit
from public.distributions d
left join public.collections c on c.id = d.collection_id
left join public.depots dp on dp.id = d.depot_id
left join public.profiles p on p.id = d.distributor_id
left join public.confirmations cf on cf.distribution_id = d.id
join public.v_receipt_status s on s.distribution_id = d.id;

revoke all on public.v_collection_list, public.v_receipt_list from public, anon, authenticated;
grant select on public.v_collection_list, public.v_receipt_list to authenticated;
