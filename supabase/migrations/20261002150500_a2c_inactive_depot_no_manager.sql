-- -----------------------------------------------------------------------------
-- A2c (Admin data: users), follow-up: an inactive depot has no manager.
--
-- WHY:  Owner decisions Q-58a and Q-58c: an inactive depot is not given to a
--       manager, and an inactive depot has no manager. The save functions
--       (this file's next part, and admin_save_user) are not the only guard:
--       the rule is also kept by the table itself (SEC-1).
-- HOW:  1. A trigger on `profiles`: whenever an active depot manager gets a
--          depot (insert, or a change of role, status or depot), that depot
--          must be active, or the change is refused with INVALID_USER.
--       2. One-time clean-up: any active manager whose depot is inactive is set
--          inactive and loses the depot (USR-03: only an active manager has one).
-- WHEN: Run once per project, after the A2c part 4 file and before the next file.
-- SECURITY: The trigger function cannot be called through the API (it returns
--       `trigger`, and execute is revoked). It reads `depots` as its owner, so it
--       works for every caller of the save functions.
-- -----------------------------------------------------------------------------
create function public.check_manager_depot_active()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- RULE Q-58a / Q-58c: an inactive depot has no manager, so it cannot be given to one.
  if not exists (select 1 from public.depots d where d.id = new.depot_id and d.status = 'active') then
    raise exception 'INVALID_USER';
  end if;
  return new;
end
$$;

revoke all on function public.check_manager_depot_active() from public, anon, authenticated;

-- Runs only for an active depot manager who has a depot, so every other change is untouched.
create trigger profiles_manager_depot_active
  before insert or update of role, status, depot_id on public.profiles
  for each row
  when (new.role = 'depot_manager' and new.status = 'active' and new.depot_id is not null)
  execute function public.check_manager_depot_active();

-- Clean-up of data made before this rule: no active manager at an inactive depot.
-- The new status is "inactive", so the trigger above does not apply to it.
update public.profiles
set status = 'inactive', depot_id = null
where role = 'depot_manager' and status = 'active'
  and depot_id in (select d.id from public.depots d where d.status = 'inactive');
