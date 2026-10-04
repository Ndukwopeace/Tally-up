-- -----------------------------------------------------------------------------
-- A3a (operational data), part 5 of 6: views that apply corrections.
--
-- WHY:  Original rows are never changed (COR-02), so "the value in force" is the
--       original unless a correction exists. Every balance and status is computed
--       from these values, never stored (REC-01, REC-02, COR-05).
-- HOW:  `v_latest_corrections` keeps the newest correction for each corrected
--       field. The `*_effective` views join it to the lines and give the quantity
--       in force, whether it was corrected (COR-04), and the loaves
--       (quantity x the snapshot taken at submit, PRD-06).
-- WHEN: Run once per project, after part 4.
-- SECURITY: All views use security_invoker, so Row Level Security of the tables
--       underneath applies to whoever reads them (§6.3). No access for signed-out visitors.
-- -----------------------------------------------------------------------------
create view public.v_latest_corrections with (security_invoker = true) as
select distinct on (target_table, target_id, field)
  target_table, target_id, field, corrected_value, created_at
from public.corrections
order by target_table, target_id, field, created_at desc, id desc;

create view public.v_collection_items_effective with (security_invoker = true) as
select ci.id, ci.collection_id, ci.product_id, ci.unit,
  ci.quantity as quantity_original,
  coalesce(lc.corrected_value::integer, ci.quantity) as quantity_effective,
  lc.corrected_value is not null as is_corrected,
  coalesce(lc.corrected_value::integer, ci.quantity) * ci.loaves_per_unit_snapshot as loaves
from public.collection_items ci
left join public.v_latest_corrections lc
  on lc.target_table = 'collection_items' and lc.target_id = ci.id and lc.field = 'quantity';

create view public.v_distribution_items_effective with (security_invoker = true) as
select di.id, di.distribution_id, di.product_id, di.unit,
  di.quantity as quantity_original,
  coalesce(lc.corrected_value::integer, di.quantity) as quantity_effective,
  lc.corrected_value is not null as is_corrected,
  coalesce(lc.corrected_value::integer, di.quantity) * di.loaves_per_unit_snapshot as loaves
from public.distribution_items di
left join public.v_latest_corrections lc
  on lc.target_table = 'distribution_items' and lc.target_id = di.id and lc.field = 'quantity';

create view public.v_confirmation_counts_effective with (security_invoker = true) as
select cc.id, cc.confirmation_id, cc.distribution_item_id, cc.unit,
  cc.quantity as quantity_original,
  coalesce(lc.corrected_value::integer, cc.quantity) as quantity_effective,
  lc.corrected_value is not null as is_corrected,
  coalesce(lc.corrected_value::integer, cc.quantity) * cc.loaves_per_unit_snapshot as loaves
from public.confirmation_counts cc
left join public.v_latest_corrections lc
  on lc.target_table = 'confirmation_counts' and lc.target_id = cc.id and lc.field = 'quantity';

create view public.v_confirmations_effective with (security_invoker = true) as
select cf.id, cf.distribution_id, cf.manager_id, cf.confirmed_at,
  cf.comment as comment_original,
  coalesce(lc.corrected_value, cf.comment) as comment_effective,
  lc.corrected_value is not null as is_corrected
from public.confirmations cf
left join public.v_latest_corrections lc
  on lc.target_table = 'confirmations' and lc.target_id = cf.id and lc.field = 'comment';

revoke all on public.v_latest_corrections, public.v_collection_items_effective,
  public.v_distribution_items_effective, public.v_confirmation_counts_effective,
  public.v_confirmations_effective from public, anon, authenticated;
grant select on public.v_latest_corrections, public.v_collection_items_effective,
  public.v_distribution_items_effective, public.v_confirmation_counts_effective,
  public.v_confirmations_effective to authenticated;
