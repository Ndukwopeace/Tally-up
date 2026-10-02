-- -----------------------------------------------------------------------------
-- A2c (Admin data: users), part 3 of 4: the rules a user change must meet.
--
-- WHY:  Accounts decide who can sign in. The rules live in the database, so
--       they hold even if the server function or the app is wrong (SEC-1).
-- HOW:  assert_user_change() raises one named error and changes nothing:
--       NOT_ADMIN (the caller is not an active admin), NOT_FOUND, INVALID_USER,
--       DEPOT_REQUIRED (an active manager needs a depot, USR-03, Q-57c),
--       CANNOT_DEACTIVATE_SELF and LAST_ADMIN (Q-57f, USR-06).
-- WHEN: Run once per project, after part 2 and before part 4.
-- SECURITY: Not callable through the API. It locks the target and the other
--       active admins, so two admins cannot demote each other at the same moment.
-- -----------------------------------------------------------------------------
create function public.assert_user_change(
  acting_admin uuid,
  target uuid,
  is_new boolean,
  new_role public.app_role,
  new_status public.record_status,
  new_depot uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  old_role public.app_role;
  old_status public.record_status;
  other_admins int;
  admin_role constant public.app_role := 'admin';
  manager_role constant public.app_role := 'depot_manager';
  active constant public.record_status := 'active';
begin
  -- SECURITY: only an active admin may change accounts (AUTH-09, USR-01).
  if not exists (select 1 from public.profiles p where p.id = acting_admin and p.role = admin_role and p.status = active) then
    raise exception 'NOT_ADMIN';
  end if;

  if is_new then
    if exists (select 1 from public.profiles p where p.id = target) then
      raise exception 'INVALID_USER';
    end if;
  else
    select p.role, p.status into old_role, old_status from public.profiles p where p.id = target for update;
    if not found then
      raise exception 'NOT_FOUND';
    end if;
  end if;

  -- RULE USR-06 / Q-57f: an admin cannot deactivate their own account.
  if new_status <> active and target = acting_admin then
    raise exception 'CANNOT_DEACTIVATE_SELF';
  end if;

  -- RULE USR-06 / Q-57f: the last active admin cannot be deactivated or given another role.
  if not is_new and old_role = admin_role and old_status = active and (new_role <> admin_role or new_status <> active) then
    select count(*)::int into other_admins
    from (select p.id from public.profiles p
          where p.role = admin_role and p.status = active and p.id <> target order by p.id for update) as others;
    if other_admins = 0 then
      raise exception 'LAST_ADMIN';
    end if;
  end if;

  -- RULE USR-03 / Q-57c / Q-57g: only an active depot manager has a depot, and must have one.
  if new_role = manager_role and new_status = active and new_depot is null then
    raise exception 'DEPOT_REQUIRED';
  end if;
  if new_depot is not null and (new_role <> manager_role or new_status <> active
      or not exists (select 1 from public.depots d where d.id = new_depot)) then
    raise exception 'INVALID_USER';
  end if;
end
$$;

revoke all on function public.assert_user_change(uuid, uuid, boolean, public.app_role, public.record_status, uuid)
  from public, anon, authenticated;
