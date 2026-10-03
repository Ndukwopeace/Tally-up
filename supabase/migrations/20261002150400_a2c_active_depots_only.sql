-- -----------------------------------------------------------------------------
-- A2c (Admin data: users), follow-up: inactive depots are not given to managers.
--
-- WHY:  Owner decision Q-58: an inactive depot must not be offered to, or given
--       to, a depot manager. Part 3 only checked that the depot exists.
-- HOW:  Replaces assert_user_change() from part 3 (a merged file is never edited,
--       DB-2). The new rule: a chosen depot must be active, unless it is the depot
--       the account already runs (so editing a manager does not fail because their
--       depot was deactivated later). Everything else is unchanged.
-- WHEN: Run once per project, after the A2c part 4 file.
-- SECURITY: Same as part 3: not callable through the API (the revoke from part 3
--       stays in force when a function is replaced).
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
  old_depot uuid;
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
    select p.role, p.status, p.depot_id into old_role, old_status, old_depot from public.profiles p where p.id = target for update;
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
  -- RULE Q-58: an inactive depot cannot be given to a manager; a manager keeps one that became inactive.
  if new_role = manager_role and new_status = active and new_depot is null then
    raise exception 'DEPOT_REQUIRED';
  end if;
  if new_depot is not null and (new_role <> manager_role or new_status <> active
      or not exists (select 1 from public.depots d where d.id = new_depot and (d.status = active or d.id = old_depot))) then
    raise exception 'INVALID_USER';
  end if;
end
$$;

revoke all on function public.assert_user_change(uuid, uuid, boolean, public.app_role, public.record_status, uuid)
  from public, anon, authenticated;
