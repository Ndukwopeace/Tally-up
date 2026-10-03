-- -----------------------------------------------------------------------------
-- A2c (Admin data: users), follow-up 2: an inactive depot has no manager.
--
-- WHY:  Owner decision Q-58c: an inactive depot must not have a manager. The
--       previous file let a manager keep a depot that became inactive; that can
--       no longer happen, because deactivating a depot now deactivates its
--       manager (next file).
-- HOW:  1. Replaces assert_user_change() (a merged file is never edited, DB-2):
--          the chosen depot must be active, with no exception.
--       2. One-time clean-up: any active manager whose depot is inactive is set
--          inactive and loses the depot (USR-03: only an active manager has one).
-- WHEN: Run once per project, after the previous A2c file and before the next.
-- SECURITY: Same as before: not callable through the API (the revoke stays in force).
-- -----------------------------------------------------------------------------
create or replace function public.assert_user_change(
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
  -- RULE Q-58a / Q-58c: an inactive depot has no manager, so it cannot be given to one.
  if new_role = manager_role and new_status = active and new_depot is null then
    raise exception 'DEPOT_REQUIRED';
  end if;
  if new_depot is not null and (new_role <> manager_role or new_status <> active
      or not exists (select 1 from public.depots d where d.id = new_depot and d.status = active)) then
    raise exception 'INVALID_USER';
  end if;
end
$$;

revoke all on function public.assert_user_change(uuid, uuid, boolean, public.app_role, public.record_status, uuid)
  from public, anon, authenticated;

-- Clean-up of data made before this rule: no active manager at an inactive depot.
update public.profiles
set status = 'inactive', depot_id = null
where role = 'depot_manager' and status = 'active'
  and depot_id in (select d.id from public.depots d where d.status = 'inactive');
