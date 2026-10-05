-- -----------------------------------------------------------------------------
-- MVP write functions, part 2 of 4: submit_collection(), the only way to record a collection.
--
-- WHY:  A distributor records what they picked up (COL-01 to COL-07). The rules that
--       keep the numbers true live here, in the database, because the app can be
--       bypassed (SEC-2): whole quantities above zero, only units the product
--       supports, no same product and unit twice, loaves per unit frozen now (PRD-06).
-- HOW:  Takes the lines as JSON: [{"product_id": "...", "unit": "Caisse", "quantity": 10}].
--       Checks the caller is an active distributor, reads the lines (read_lines),
--       refuses an inactive product and a unit the product does not support, then
--       inserts the collection and its lines in one step and logs it (AUD-03).
--       The time and number are set by the database (COL-06, §11). Raises
--       NOT_DISTRIBUTOR, INVALID_ITEMS, INVALID_QUANTITY, DUPLICATE_LINE,
--       PRODUCT_INACTIVE or UNIT_NOT_SUPPORTED; returns the new collection's id.
-- WHEN: Run once per project, after part 1.
-- SECURITY: SECURITY DEFINER with an empty search path. The distributor is always
--       the caller (`auth.uid()`); no id is taken from the request. A refused call
--       changes nothing, because it is one transaction.
-- -----------------------------------------------------------------------------
create function public.submit_collection(p_items jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- RULE AUTH-09 / COL-01: only an active distributor records collections.
  if public.current_app_role() is distinct from 'distributor' then
    raise exception 'NOT_DISTRIBUTOR';
  end if;

  if exists (
    select 1 from public.read_lines(p_items, 'product_id', 1) l
    join public.products p on p.id = l.line_ref where p.status <> 'active'
  ) then
    raise exception 'PRODUCT_INACTIVE';
  end if;
  -- RULE COL-02: the unit must be one the product supports (an unknown product has none).
  if exists (
    select 1 from public.read_lines(p_items, 'product_id', 1) l
    left join public.product_units pu on pu.product_id = l.line_ref and pu.unit = l.line_unit
    where pu.id is null
  ) then
    raise exception 'UNIT_NOT_SUPPORTED';
  end if;

  insert into public.collections (distributor_id) values (auth.uid()) returning id into v_id;
  -- RULE PRD-06: the loaves per unit are copied now and never change afterwards.
  insert into public.collection_items (collection_id, product_id, unit, quantity, loaves_per_unit_snapshot)
  select v_id, l.line_ref, l.line_unit, l.line_quantity, pu.loaves_per_unit
  from public.read_lines(p_items, 'product_id', 1) l
  join public.product_units pu on pu.product_id = l.line_ref and pu.unit = l.line_unit;

  -- RULE AUD-03: collection created.
  insert into public.audit_log (user_id, action, record_type, record_id)
  values (auth.uid(), 'collection_created', 'collection', v_id::text);
  return v_id;
end
$$;
revoke all on function public.submit_collection(jsonb) from public, anon;
grant execute on function public.submit_collection(jsonb) to authenticated;
