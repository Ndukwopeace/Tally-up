-- -----------------------------------------------------------------------------
-- A2b (Admin data), part 1 of 3: depots, managers' depots, who may read them.
--
-- WHY:  Distributors hand bread to depots; each depot's manager confirms it
--       (REQUIREMENTS §5.3). The admin keeps depots and one manager each (DEP-03).
-- HOW:  Phone rule (Q-57i); `depots`; `profiles.depot_id` with USR-03 checks;
--       one active manager per depot; `current_depot_id()` and RLS. Writes go
--       only through admin_save_depot() (part 3). Kept under 100 lines.
-- WHEN: Run once per project after the A2a files, then parts 2 and 3.
-- SECURITY: No API role writes these tables. Admins read all depots;
--       distributors read active ones (DEP-06); a manager reads their own.
-- -----------------------------------------------------------------------------

-- RULE Q-57i: optional Cameroon numbers, stored as +237 then 9 digits (2… or 6…).
create function public.is_cameroon_phone_list(phones text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select not exists (
    select 1 from unnest(phones) as phone where phone is null or phone !~ '^\+237[26][0-9]{8}$'
  )
$$;

create table public.depots (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  location text not null check (length(btrim(location)) > 0),
  -- "Address/Description" (DEP-02): required (owner, A2b).
  address text not null check (length(btrim(address)) > 0),
  phones text[] not null default '{}' check (public.is_cameroon_phone_list(phones)),
  status public.record_status not null default 'active',
  created_at timestamptz not null default now()
);

-- SECURITY: RLS on straight after the table (the SQL editor checks for this).
alter table public.depots enable row level security;

-- A depot manager's depot (USR-03). Managers created while testing A1, before
-- depots existed, cannot stay active without one: they are set inactive, and
-- assigning them to a depot reactivates them (Q-57c).
alter table public.profiles add column depot_id uuid references public.depots (id) on delete restrict;
update public.profiles set status = 'inactive'
where role = 'depot_manager' and status = 'active' and depot_id is null;

-- RULE USR-03: only depot managers have a depot; an active one always has one.
alter table public.profiles add constraint profiles_depot_only_for_managers
  check (role = 'depot_manager' or depot_id is null);
alter table public.profiles add constraint profiles_active_manager_has_depot
  check (role <> 'depot_manager' or status <> 'active' or depot_id is not null);

-- RULE DEP-03: one active manager per depot.
create unique index profiles_one_active_manager_per_depot
  on public.profiles (depot_id) where role = 'depot_manager' and status = 'active';

-- The caller's own depot (null for other roles). SECURITY DEFINER so a depots
-- policy can read profiles without recursion.
create function public.current_depot_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.depot_id from public.profiles p where p.id = auth.uid() and p.status = 'active'
$$;

-- Admins: all. Distributors: active depots (their picker, DEP-06). Depot
-- managers: their own depot, even if deactivated (DEP-06).
create policy "depots: read by role"
  on public.depots for select
  to authenticated
  using (
    public.is_admin()
    or (public.current_app_role() = 'distributor' and status = 'active')
    or id = public.current_depot_id()
  );

revoke all on table public.depots from public, anon, authenticated;
grant select on table public.depots to authenticated;
revoke all on function public.is_cameroon_phone_list(text[]) from public, anon;
grant execute on function public.is_cameroon_phone_list(text[]) to authenticated;
revoke all on function public.current_depot_id() from public, anon;
grant execute on function public.current_depot_id() to authenticated;
