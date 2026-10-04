-- -----------------------------------------------------------------------------
-- A3a (operational data), part 6 of 6: balances and statuses.
--
-- WHY:  Remaining, Distributed, Difference and both statuses are computed, never
--       stored, so they cannot drift out of step (REQUIREMENTS §9). All
--       comparisons are in loaves (REC-01, REC-04).
-- HOW:  - v_collection_product_balance: per collection and product, Collected =
--         Distributed + Remaining (REC-01).
--       - v_collection_status: In Progress while any product has Remaining above
--         zero, otherwise Fully Distributed (COL-08).
--       - v_receipt_line: per hand-over line, Recorded, Counted and Difference =
--         Counted - Recorded (REC-02); counts are empty until the depot confirms.
--       - v_receipt_status: Awaiting Confirmation, Confirmed, or Confirmed with
--         Discrepancy when any line differs (RCP-11).
--       All use corrected values where a correction exists (COR-05).
-- WHEN: Run once per project, after part 5.
-- SECURITY: security_invoker views: each role sees only its own records (§6.5).
-- -----------------------------------------------------------------------------
create view public.v_collection_product_balance with (security_invoker = true) as
with collected as (
  select collection_id, product_id, sum(loaves) as loaves
  from public.v_collection_items_effective group by collection_id, product_id
), distributed as (
  select d.collection_id, di.product_id, sum(di.loaves) as loaves
  from public.v_distribution_items_effective di
  join public.distributions d on d.id = di.distribution_id
  group by d.collection_id, di.product_id
)
select c.collection_id, c.product_id,
  c.loaves as collected_loaves,
  coalesce(x.loaves, 0) as distributed_loaves,
  c.loaves - coalesce(x.loaves, 0) as remaining_loaves
from collected c
left join distributed x on x.collection_id = c.collection_id and x.product_id = c.product_id;

create view public.v_collection_status with (security_invoker = true) as
select collection_id,
  case when bool_or(remaining_loaves > 0) then 'in_progress' else 'fully_distributed' end as status
from public.v_collection_product_balance
group by collection_id;

create view public.v_receipt_line with (security_invoker = true) as
select di.id as distribution_item_id, di.distribution_id, di.product_id, di.unit,
  di.quantity_effective as recorded_quantity,
  di.loaves as recorded_loaves,
  case when cf.id is null then null else coalesce(counted.loaves, 0) end as counted_loaves,
  case when cf.id is null then null else coalesce(counted.loaves, 0) - di.loaves end as difference_loaves
from public.v_distribution_items_effective di
left join public.confirmations cf on cf.distribution_id = di.distribution_id
left join lateral (
  select sum(cc.loaves) as loaves from public.v_confirmation_counts_effective cc
  where cc.confirmation_id = cf.id and cc.distribution_item_id = di.id
) counted on true;

create view public.v_receipt_status with (security_invoker = true) as
select l.distribution_id,
  case
    when bool_or(l.counted_loaves is null) then 'awaiting_confirmation'
    when bool_or(l.difference_loaves <> 0) then 'confirmed_with_discrepancy'
    else 'confirmed'
  end as status
from public.v_receipt_line l
group by l.distribution_id;

revoke all on public.v_collection_product_balance, public.v_collection_status,
  public.v_receipt_line, public.v_receipt_status from public, anon, authenticated;
grant select on public.v_collection_product_balance, public.v_collection_status,
  public.v_receipt_line, public.v_receipt_status to authenticated;
