-- -----------------------------------------------------------------------------
-- A2b (Admin data), part 2 of 3: assign_depot_manager(), used by part 3.
--
-- WHY:  Keeps admin_save_depot() short; this puts one manager in charge of one
--       depot (DEP-03) and deactivates whoever ran it before (Q-57c).
-- HOW:  Refuses an account that is not a depot manager (NOT_A_MANAGER). Does
--       nothing if they already run this depot. Otherwise the previous manager
--       is set inactive with no depot, and the chosen one becomes active at
--       this depot. Both changes are logged (AUD-03).
-- WHEN: Run once per project, after part 1 and before part 3.
-- SECURITY: Not callable through the API (execute revoked from every API
--       role). Only admin_save_depot(), which checks for an active admin, calls it.
-- -----------------------------------------------------------------------------
create function public.assign_depot_manager(saved_depot uuid, chosen uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  chosen_role public.app_role;
  chosen_status public.record_status;
  chosen_depot uuid;
  replaced uuid;
begin
  select p.role, p.status, p.depot_id into chosen_role, chosen_status, chosen_depot
  from public.profiles p where p.id = chosen for update;
  if not found or chosen_role <> 'depot_manager' then
    raise exception 'NOT_A_MANAGER';
  end if;
  if chosen_depot = saved_depot and chosen_status = 'active' then
    return;
  end if;

  -- RULE DEP-03 / Q-57c: whoever ran this depot before is deactivated and loses it.
  select p.id into replaced from public.profiles p
  where p.depot_id = saved_depot and p.role = 'depot_manager' and p.status = 'active' and p.id <> chosen
  for update;
  if found then
    update public.profiles set status = 'inactive', depot_id = null where id = replaced;
    insert into public.audit_log (user_id, action, record_type, record_id, details)
    values (auth.uid(), 'user.deactivated', 'user', replaced::text,
            jsonb_build_object('reason', 'replaced as depot manager', 'depot_id', saved_depot));
  end if;

  update public.profiles set depot_id = saved_depot, status = 'active' where id = chosen;
  insert into public.audit_log (user_id, action, record_type, record_id, details)
  values (auth.uid(), 'depot.manager_assigned', 'depot', saved_depot::text, jsonb_build_object('manager_id', chosen));
end
$$;

revoke all on function public.assign_depot_manager(uuid, uuid) from public, anon, authenticated;
