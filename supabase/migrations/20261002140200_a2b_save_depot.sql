-- -----------------------------------------------------------------------------
-- A2b (Admin data), part 3 of 3: admin_save_depot(), the only write path.
--
-- WHY:  One call creates or edits a depot, optionally assigns its manager, and
--       logs every change (AUD-03).
-- HOW:  target_depot_id null = create. manager_id null = keep the current
--       manager. Raises NOT_ADMIN, NOT_FOUND, INVALID_DEPOT or NOT_A_MANAGER,
--       which the app shows in plain words.
-- WHEN: Run once per project, after parts 1 and 2.
-- SECURITY: Checks the caller is an active admin before anything else; takes
--       no user id, so audit entries always name the real caller.
-- -----------------------------------------------------------------------------
create function public.admin_save_depot(
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
  -- record_type of the depot entries written here.
  record_kind constant text := 'depot';
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN';
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

  if manager_id is not null then
    perform public.assign_depot_manager(saved_id, manager_id);
  end if;
  return saved_id;
end
$$;

revoke all on function public.admin_save_depot(uuid, text, text, text, text[], public.record_status, uuid)
  from public, anon;
grant execute on function public.admin_save_depot(uuid, text, text, text, text[], public.record_status, uuid)
  to authenticated;
