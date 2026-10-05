-- -----------------------------------------------------------------------------
-- MVP write functions, part 3 of 4: submit_distribution(), the only way to hand bread to a depot.
--
-- WHY:  A distributor hands part of a collection to a depot (DIS-01 to DIS-10). The
--       rule that matters most: never give more than remains, per product, compared
--       in loaves, even in a different unit from the one collected (DIS-04, DIS-06).
--       Two phones giving the same bread at the same moment must not both succeed.
-- HOW:  Takes the collection, the depot and the lines as JSON. Checks the caller is an
--       active distributor and that the collection is their own, and LOCKS that
--       collection row, so a second hand-over from the same collection waits and
--       then sees the first one. Then: an active depot (DIS-03); lines read
--       (read_lines); every product was collected; every unit is supported; per
--       product the loaves given do not exceed what remains (corrections applied,
--       from v_collection_product_balance). Inserts the hand-over and its lines,
--       logs it (AUD-03) and returns the id. The receipt starts Awaiting
--       Confirmation, which is computed, not stored (RCP-11). Raises NOT_DISTRIBUTOR,
--       COLLECTION_NOT_FOUND, DEPOT_INACTIVE, INVALID_ITEMS, INVALID_QUANTITY,
--       DUPLICATE_LINE, PRODUCT_NOT_IN_COLLECTION, UNIT_NOT_SUPPORTED, OVER_DISTRIBUTION.
-- WHEN: Run once per project, after part 2.
-- SECURITY: SECURITY DEFINER, empty search path. The distributor is the caller and may
--       only use their own collection. Notifications (NOT-01) are not sent yet (Q-60).
-- -----------------------------------------------------------------------------
create function public.submit_distribution(p_collection uuid, p_depot uuid, p_items jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if public.current_app_role() is distinct from 'distributor' then
    raise exception 'NOT_DISTRIBUTOR';
  end if;
  -- RULE DIS-01: only the distributor's own collection. The lock is the guard against double-giving.
  perform 1 from public.collections c where c.id = p_collection and c.distributor_id = auth.uid() for update;
  if not found then
    raise exception 'COLLECTION_NOT_FOUND';
  end if;
  -- RULE DIS-03: an active depot.
  if not exists (select 1 from public.depots d where d.id = p_depot and d.status = 'active') then
    raise exception 'DEPOT_INACTIVE';
  end if;

  -- RULE DIS-05: every line is above zero and there is at least one.
  perform 1 from public.read_lines(p_items, 'product_id', 1);
  if exists (
    select 1 from public.read_lines(p_items, 'product_id', 1) l
    where not exists (select 1 from public.collection_items ci
      where ci.collection_id = p_collection and ci.product_id = l.line_ref)
  ) then
    raise exception 'PRODUCT_NOT_IN_COLLECTION';
  end if;
  if exists (
    select 1 from public.read_lines(p_items, 'product_id', 1) l
    left join public.product_units pu on pu.product_id = l.line_ref and pu.unit = l.line_unit
    where pu.id is null
  ) then
    raise exception 'UNIT_NOT_SUPPORTED';
  end if;
  -- RULE DIS-06 / REC-04: per product, in loaves, never more than remains.
  if exists (
    select 1
    from (select l.line_ref as product_id, sum(l.line_quantity * pu.loaves_per_unit) as give
          from public.read_lines(p_items, 'product_id', 1) l
          join public.product_units pu on pu.product_id = l.line_ref and pu.unit = l.line_unit
          group by l.line_ref) g
    join public.v_collection_product_balance b
      on b.collection_id = p_collection and b.product_id = g.product_id
    where g.give > b.remaining_loaves
  ) then
    raise exception 'OVER_DISTRIBUTION';
  end if;

  insert into public.distributions (collection_id, depot_id, distributor_id)
  values (p_collection, p_depot, auth.uid()) returning id into v_id;
  insert into public.distribution_items (distribution_id, product_id, unit, quantity, loaves_per_unit_snapshot)
  select v_id, l.line_ref, l.line_unit, l.line_quantity, pu.loaves_per_unit
  from public.read_lines(p_items, 'product_id', 1) l
  join public.product_units pu on pu.product_id = l.line_ref and pu.unit = l.line_unit;

  -- RULE AUD-03: distribution submitted.
  insert into public.audit_log (user_id, action, record_type, record_id)
  values (auth.uid(), 'distribution_submitted', 'distribution', v_id::text);
  return v_id;
end
$$;
revoke all on function public.submit_distribution(uuid, uuid, jsonb) from public, anon;
grant execute on function public.submit_distribution(uuid, uuid, jsonb) to authenticated;
