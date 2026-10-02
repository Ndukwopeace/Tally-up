-- -----------------------------------------------------------------------------
-- A2c (Admin data: users), part 4 of 4: admin_save_user() and the password-reset log.
--
-- WHY:  The only way to create or edit an account's Tally-Up profile (USR-01,
--       USR-02), and to log that an admin set a new password (USR-04).
-- HOW:  Called by the Vercel Function after it has checked the caller's login.
--       Checks the rules (part 3), writes the profile, puts a manager in charge
--       of their depot (DEP-03, Q-57c) and logs the change (AUD-03). A change
--       of role removes the depot (Q-57g). Errors: part 3's, plus EMAIL_TAKEN.
-- WHEN: Run once per project, after part 3.
-- SECURITY: Only the service role may run these (execute revoked from every API
--       role). They trust `acting_admin` only after assert_user_change() has
--       confirmed an active admin, so a wrong id changes nothing.
-- -----------------------------------------------------------------------------
create function public.admin_save_user(
  acting_admin uuid, target uuid, user_name text, user_email text, user_phones text[],
  user_role public.app_role, user_status public.record_status, user_depot uuid, is_new boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  old public.profiles;
  needs_assign boolean;
  inactive constant public.record_status := 'inactive';
  record_kind constant text := 'user';
begin
  -- Format check here too: the database never trusts the function or the app (SEC-1).
  if user_email is null or btrim(user_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'INVALID_USER';
  end if;
  perform public.assert_user_change(acting_admin, target, is_new, user_role, user_status, user_depot);
  select * into old from public.profiles p where p.id = target;

  -- A manager who is new at a depot goes through assign_depot_manager(), which replaces the old one.
  needs_assign := user_role = 'depot_manager' and user_status = 'active'
    and (is_new or old.depot_id is distinct from user_depot or old.status = inactive);
  begin
    if is_new then
      insert into public.profiles (id, full_name, email, phones, role, status)
      values (target, btrim(user_name), lower(btrim(user_email)), coalesce(user_phones, '{}'), user_role,
              case when needs_assign then inactive else user_status end);
    else
      update public.profiles
      set full_name = btrim(user_name), email = lower(btrim(user_email)), phones = coalesce(user_phones, '{}'),
          role = user_role, status = case when needs_assign then inactive else user_status end,
          depot_id = case when needs_assign then null else user_depot end
      where id = target;
    end if;
  exception
    when unique_violation then raise exception 'EMAIL_TAKEN';
    when check_violation or not_null_violation then raise exception 'INVALID_USER';
  end;
  if needs_assign then
    perform public.assign_depot_manager(user_depot, target, acting_admin);
  end if;

  -- RULE AUD-03: created or edited, and (de)activated when the status changed.
  insert into public.audit_log (user_id, action, record_type, record_id)
  values (acting_admin, case when is_new then 'user.created' else 'user.edited' end, record_kind, target::text);
  if not is_new and old.status <> user_status then
    insert into public.audit_log (user_id, action, record_type, record_id)
    values (acting_admin, 'user.' || case when user_status = inactive then 'deactivated' else 'activated' end,
            record_kind, target::text);
  end if;
end
$$;

-- USR-04 / AUD-03: the password itself is set by the function in Supabase Auth and never reaches here.
create function public.admin_record_password_reset(acting_admin uuid, target uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = acting_admin and p.role = 'admin' and p.status = 'active') then
    raise exception 'NOT_ADMIN';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target) then
    raise exception 'NOT_FOUND';
  end if;
  insert into public.audit_log (user_id, action, record_type, record_id)
  values (acting_admin, 'user.password_reset', 'user', target::text);
end
$$;

-- Only the service role (the server function) may call these.
revoke all on function public.admin_save_user(uuid, uuid, text, text, text[], public.app_role, public.record_status, uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.admin_record_password_reset(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_save_user(uuid, uuid, text, text, text[], public.app_role, public.record_status, uuid, boolean)
  to service_role;
grant execute on function public.admin_record_password_reset(uuid, uuid) to service_role;
