-- -----------------------------------------------------------------------------
-- MVP write functions, part 4 of 4: confirm_receipt(), the only way to confirm a receipt.
--
-- WHY:  The depot manager counts what arrived and confirms it (RCP-01 to RCP-15). The
--       system, never the manager, decides whether it matches (RCP-11). Once
--       confirmed, counts, comment and status are locked (RCP-12).
-- HOW:  Takes the hand-over, the counts and an optional comment. Counts are JSON:
--       [{"item_id": "...", "unit": "Pack", "quantity": 19}, {"item_id": "...",
--       "unit": "Loaf", "quantity": 5}], so one line can be counted in several units
--       (RCP-06). Checks the caller is an active depot manager and the receipt is
--       their own depot's, and LOCKS the hand-over so a double tap confirms once.
--       Then: not already confirmed (RCP-12); the comment is at most 1,000 characters
--       and blank counts as none (RCP-09); counts read (read_lines, zero allowed,
--       RCP-07); each belongs to this receipt; each unit is supported by that
--       line's product (RCP-05); EVERY line has at least one count (RCP-04, so
--       nothing is assumed to match). Inserts the confirmation and counts with the
--       loaves per unit frozen now, and logs it and any discrepancy (AUD-03).
--       Returns the confirmation id. Raises NOT_DEPOT_MANAGER, RECEIPT_NOT_FOUND, ALREADY_CONFIRMED, COMMENT_TOO_LONG,
--       INVALID_ITEMS, INVALID_QUANTITY, DUPLICATE_LINE, INVALID_ITEM,
--       UNIT_NOT_SUPPORTED, COUNT_MISSING.
-- WHEN: Run once per project, after part 3.
-- SECURITY: SECURITY DEFINER, empty search path. The manager is the caller and only
--       their own depot's receipts are reachable. Notifications (NOT-02 to NOT-04)
--       are not sent yet (Q-60).
-- -----------------------------------------------------------------------------
create function public.confirm_receipt(p_distribution uuid, p_counts jsonb, p_comment text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_comment text := nullif(btrim(p_comment), '');
begin
  if public.current_app_role() is distinct from 'depot_manager' then
    raise exception 'NOT_DEPOT_MANAGER';
  end if;
  -- RULE RCP-01: only the manager's own depot. The lock makes a double tap confirm once.
  perform 1 from public.distributions d
    where d.id = p_distribution and d.depot_id = public.current_depot_id() for update;
  if not found then
    raise exception 'RECEIPT_NOT_FOUND';
  end if;
  if exists (select 1 from public.confirmations c where c.distribution_id = p_distribution) then
    raise exception 'ALREADY_CONFIRMED';
  end if;
  if length(v_comment) > 1000 then
    raise exception 'COMMENT_TOO_LONG';
  end if;

  perform 1 from public.read_lines(p_counts, 'item_id', 0);
  if exists (
    select 1 from public.read_lines(p_counts, 'item_id', 0) l
    where not exists (select 1 from public.distribution_items di
      where di.id = l.line_ref and di.distribution_id = p_distribution)
  ) then
    raise exception 'INVALID_ITEM';
  end if;
  if exists (
    select 1 from public.read_lines(p_counts, 'item_id', 0) l
    join public.distribution_items di on di.id = l.line_ref
    left join public.product_units pu on pu.product_id = di.product_id and pu.unit = l.line_unit
    where pu.id is null
  ) then
    raise exception 'UNIT_NOT_SUPPORTED';
  end if;
  -- RULE RCP-04: every line is counted by hand; a missing count is never read as a match.
  if exists (
    select 1 from public.distribution_items di
    where di.distribution_id = p_distribution
      and not exists (select 1 from public.read_lines(p_counts, 'item_id', 0) l where l.line_ref = di.id)
  ) then
    raise exception 'COUNT_MISSING';
  end if;

  insert into public.confirmations (distribution_id, manager_id, comment)
  values (p_distribution, auth.uid(), v_comment) returning id into v_id;
  insert into public.confirmation_counts
    (confirmation_id, distribution_item_id, unit, quantity, loaves_per_unit_snapshot)
  select v_id, l.line_ref, l.line_unit, l.line_quantity, pu.loaves_per_unit
  from public.read_lines(p_counts, 'item_id', 0) l
  join public.distribution_items di on di.id = l.line_ref
  join public.product_units pu on pu.product_id = di.product_id and pu.unit = l.line_unit;

  -- RULE AUD-03: receipt confirmed; discrepancy detected when a line differs (RCP-11).
  insert into public.audit_log (user_id, action, record_type, record_id)
  values (auth.uid(), 'receipt_confirmed', 'distribution', p_distribution::text);
  if exists (select 1 from public.v_receipt_status s
             where s.distribution_id = p_distribution and s.status = 'confirmed_with_discrepancy') then
    insert into public.audit_log (user_id, action, record_type, record_id)
    values (auth.uid(), 'discrepancy_detected', 'distribution', p_distribution::text);
  end if;
  return v_id;
end
$$;
revoke all on function public.confirm_receipt(uuid, jsonb, text) from public, anon;
grant execute on function public.confirm_receipt(uuid, jsonb, text) to authenticated;
