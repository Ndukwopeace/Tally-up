-- -----------------------------------------------------------------------------
-- A2c (Admin data: users), follow-up 3: deactivating a depot removes its manager.
--
-- WHY:  Owner decision Q-58c: an inactive depot has no manager. Saving a depot
--       as inactive therefore deactivates its manager and takes them off the
--       depot, the same way a replaced manager is handled (Q-57c). The form says
--       so before saving. A manager cannot be chosen for an inactive depot.
-- HOW:  Replaces admin_save_depot() from A2b (a merged file is never edited,
--       DB-2). New: INVALID_DEPOT when a manager is chosen for an inactive depot;
--       otherwise the active manager of a depot switched to inactive is set
--       inactive with no depot, and the change is logged (AUD-03).
-- WHEN: Run once per project, after the previous A2c file.
-- SECURITY: Unchanged: only an active admin may call it (checked first). The
--       grants from A2b stay in force when a function is replaced.
-- -----------------------------------------------------------------------------
create or replace function public.admin_save_depot(
  target_depot_id uuid,
  depot_name text,
  depot_location text,
  depot_address text,
  depot_phones text[],
  depot_status public.record_status,
  manager_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  saved_id uuid;
  old_status public.record_status;
  old_manager uuid;
  -- record_type of the depot entries written here.
  record_kind constant text := 'depot';
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN';
  end if;
  -- RULE Q-58c: an inactive depot has no manager, so none can be chosen for it.
  if depot_status = 'inactive' and manager_id is not null then
    raise exception 'INVALID_DEPOT';
  end if;

  begin
    if target_depot_id is null then
      insert into public.depots (name, location, address, phones, status)
      values (btrim(depot_name), btrim(depot_location), btrim(depot_address), coalesce(depot_phones, '{}'), depot_status)
      returning id into saved_id;
      insert into public.audit_log (user_id, action, record_type, record_id)
      values (auth.uid(), 'depot.created', record_kind, saved_id::text);
    else
      select d.status into old_status from public.depots d where d.id = target_depot_id for update;
      if not found then
        raise exception 'NOT_FOUND';
      end if;
      update public.depots
      set name = btrim(depot_name), location = btrim(depot_location), address = btrim(depot_address),
          phones = coalesce(depot_phones, '{}'), status = depot_status
      where id = target_depot_id;
      saved_id := target_depot_id;
      -- RULE AUD-03: edited, and (de)activated when the status changed.
      insert into public.audit_log (user_id, action, record_type, record_id)
      values (auth.uid(), 'depot.edited', record_kind, saved_id::text);
      if old_status <> depot_status then
        insert into public.audit_log (user_id, action, record_type, record_id)
        values (auth.uid(), 'depot.' || case when depot_status = 'inactive' then 'deactivated' else 'activated' end,
                record_kind, saved_id::text);
      end if;
    end if;
  exception
    -- Blank name, location or address, or a phone that is not +237XXXXXXXXX.
    when check_violation or not_null_violation then
      raise exception 'INVALID_DEPOT';
  end;

  -- RULE Q-58c: switching a depot to inactive deactivates its manager and takes them off it (as Q-57c).
  if depot_status = 'inactive' then
    update public.profiles set status = 'inactive', depot_id = null
    where depot_id = saved_id and role = 'depot_manager' and status = 'active'
    returning id into old_manager;
    if found then
      insert into public.audit_log (user_id, action, record_type, record_id, details)
      values (auth.uid(), 'user.deactivated', 'user', old_manager::text,
              jsonb_build_object('reason', 'depot deactivated', 'depot_id', saved_id));
    end if;
  end if;
  if manager_id is not null then
    perform public.assign_depot_manager(saved_id, manager_id);
  end if;
  return saved_id;
end
$$;
