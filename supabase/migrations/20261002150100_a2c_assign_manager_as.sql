-- -----------------------------------------------------------------------------
-- A2c (Admin data: users), part 2 of 4: assign a depot manager on behalf of an admin.
--
-- WHY:  Users are saved by the server function with the service-role key, so
--       `auth.uid()` is empty there and the audit log would not name the admin
--       who acted (AUD-02). The A2b helper takes the admin from the caller's
--       login; this version takes the admin as an argument.
-- HOW:  assign_depot_manager(depot, chosen, acting_admin) holds the same logic as
--       before (DEP-03, Q-57c). The two-argument function from A2b now calls it
--       with `auth.uid()`, so admin_save_depot() behaves exactly as it did.
-- WHEN: Run once per project, after part 1 and before part 3.
-- SECURITY: Not callable through the API (execute revoked from every API role).
--       The caller must already have checked that `acting_admin` is an active admin.
-- -----------------------------------------------------------------------------
create function public.assign_depot_manager(saved_depot uuid, chosen uuid, acting_admin uuid)
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
    values (acting_admin, 'user.deactivated', 'user', replaced::text,
            jsonb_build_object('reason', 'replaced as depot manager', 'depot_id', saved_depot));
  end if;

  update public.profiles set depot_id = saved_depot, status = 'active' where id = chosen;
  insert into public.audit_log (user_id, action, record_type, record_id, details)
  values (acting_admin, 'depot.manager_assigned', 'depot', saved_depot::text, jsonb_build_object('manager_id', chosen));
end
$$;

revoke all on function public.assign_depot_manager(uuid, uuid, uuid) from public, anon, authenticated;

-- The A2b two-argument form keeps working for admin_save_depot(): same logic, caller from the login.
create or replace function public.assign_depot_manager(saved_depot uuid, chosen uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select public.assign_depot_manager(saved_depot, chosen, auth.uid())
$$;
