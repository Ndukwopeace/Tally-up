-- -----------------------------------------------------------------------------
-- Milestone A2a (Admin data): products and their units.
--
-- WHY:  Every quantity in Tally-Up is counted in a product's units and
--       converted to loaves, the base unit (PRD-03 to PRD-05, Q-57d). The
--       admin defines, per bread, how many loaves make one Pack and one
--       Caisse; nothing is hard-coded.
-- HOW:  - `product_unit` enum: Loaf, Pack, Caisse.
--       - `products`: name, code, description, Active/Inactive. No photo (Q-57e).
--       - `product_units`: one row per unit a product supports, with its
--         loaves_per_unit. Every product has a Loaf row equal to 1.
--       - `admin_save_product(...)`: the only write path. Creates or edits a
--         product and its units in one step and writes the audit log.
--       - RLS: admins read all; distributors read active products (they pick
--         from them); depot managers read all (receipts may name old products).
-- WHEN: Applied once per Supabase project after the A1 migration (staging
--       first, DB-3). Never edit after merge (DB-2).
-- SECURITY: No API role can insert, update or delete these tables directly.
--       The save function runs as its owner but first checks the caller is an
--       active admin (is_admin()), and takes no user id, so the audit entry
--       always names the real caller.
-- -----------------------------------------------------------------------------

-- RULE PRD-03: the three units. Loaf is the base unit.
create type public.product_unit as enum ('Loaf', 'Pack', 'Caisse');

-- ---------------------------------------------------------------------------
-- products (REQUIREMENTS §9, PRD-02)
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  -- RULE Q-57h: letters, numbers and dashes, at most 20 characters.
  code text not null check (code ~ '^[A-Za-z0-9-]{1,20}$'),
  description text not null check (length(btrim(description)) > 0),
  status public.record_status not null default 'active',
  created_at timestamptz not null default now()
);

-- RULE Q-57h: unique ignoring letter case (BB-01 and bb-01 are the same code).
create unique index products_code_unique on public.products (lower(code));

-- SECURITY: Row Level Security on from the start; the read policies are below.
-- (Placed right after the table so the Supabase SQL editor sees it and does not
-- offer to add its own lines, which would break the function further down.)
alter table public.products enable row level security;

-- ---------------------------------------------------------------------------
-- product_units (PRD-03, PRD-04)
-- ---------------------------------------------------------------------------
create table public.product_units (
  id uuid primary key default gen_random_uuid(),
  -- `on delete restrict`: products are never deleted (PRD-01).
  product_id uuid not null references public.products (id) on delete restrict,
  unit public.product_unit not null,
  -- RULE PRD-04 / Q-20: whole loaves, at least one.
  loaves_per_unit integer not null check (loaves_per_unit > 0),
  -- RULE Q-21: a unit appears once per product.
  unique (product_id, unit),
  -- RULE PRD-04: a Loaf is one loaf.
  check (unit <> 'Loaf' or loaves_per_unit = 1)
);

-- SECURITY: Row Level Security on from the start; the read policy is below.
alter table public.product_units enable row level security;

-- ---------------------------------------------------------------------------
-- admin_save_product: create (product_id null) or edit a product.
-- pack_loaves / caisse_loaves: loaves in one Pack / Caisse, or null when the
-- product does not use that unit. The form converts "N Packs" to loaves
-- before calling (PRD-05), so only loaves reach the database.
-- Errors (raised as the message, mapped to plain words by the app):
--   NOT_ADMIN, NOT_FOUND, CODE_TAKEN, INVALID_PRODUCT.
-- ---------------------------------------------------------------------------
create function public.admin_save_product(
  product_id uuid,
  product_name text,
  product_code text,
  product_description text,
  product_status public.record_status,
  pack_loaves integer,
  caisse_loaves integer
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
-- Inside this function, a bare `product_id` in a table context means the
-- column (e.g. ON CONFLICT targets); the parameter is used only where no
-- such column exists.
#variable_conflict use_column
declare
  saved_id uuid;
  old_status public.record_status;
  -- One wanted unit while saving units (see the loop below).
  unit_row record;
  -- record_type of every audit entry written here.
  record_kind constant text := 'product';
begin
  -- SECURITY: only an active admin may change products (PRD-01, AUTH-10).
  if not public.is_admin() then
    raise exception 'NOT_ADMIN';
  end if;

  -- RULE PRD-04: a Pack or Caisse holds at least one loaf.
  if coalesce(pack_loaves, 1) < 1 or coalesce(caisse_loaves, 1) < 1 then
    raise exception 'INVALID_PRODUCT';
  end if;

  begin
    if product_id is null then
      insert into public.products (name, code, description, status)
      values (btrim(product_name), btrim(product_code), btrim(product_description), product_status)
      returning id into saved_id;
      -- RULE AUD-03: product created.
      insert into public.audit_log (user_id, action, record_type, record_id, details)
      values (auth.uid(), 'product.created', record_kind, saved_id::text, jsonb_build_object('code', btrim(product_code)));
    else
      select p.status into old_status from public.products p where p.id = product_id for update;
      if not found then
        raise exception 'NOT_FOUND';
      end if;
      update public.products
      set name = btrim(product_name),
          code = btrim(product_code),
          description = btrim(product_description),
          status = product_status
      where id = product_id;
      saved_id := product_id;
      -- RULE AUD-03: product edited, and (de)activated when the status changed.
      insert into public.audit_log (user_id, action, record_type, record_id)
      values (auth.uid(), 'product.edited', record_kind, saved_id::text);
      if old_status <> product_status then
        insert into public.audit_log (user_id, action, record_type, record_id)
        values (auth.uid(), 'product.' || case when product_status = 'inactive' then 'deactivated' else 'activated' end,
                record_kind, saved_id::text);
      end if;
    end if;
  exception
    -- The unique index on lower(code): another product already uses this code.
    when unique_violation then
      raise exception 'CODE_TAKEN';
    -- Blank name/description, bad code format or a null value.
    when check_violation or not_null_violation then
      raise exception 'INVALID_PRODUCT';
  end;

  -- RULE Q-57d: every product has the Loaf unit, always 1. Pack and Caisse:
  -- set, change or remove (null = not used). Past records keep their own
  -- snapshot of loaves-per-unit, so changes affect only new records (PRD-06).
  -- Loaf is the enum's first value; it is never null here, so it is always kept.
  for unit_row in
    select wanted.unit, wanted.loaves
    from unnest(enum_range(null::public.product_unit), array[1, pack_loaves, caisse_loaves])
      as wanted (unit, loaves)
  loop
    if unit_row.loaves is null then
      delete from public.product_units u where u.product_id = saved_id and u.unit = unit_row.unit;
    else
      insert into public.product_units (product_id, unit, loaves_per_unit)
      values (saved_id, unit_row.unit, unit_row.loaves)
      on conflict (product_id, unit) do update set loaves_per_unit = excluded.loaves_per_unit;
    end if;
  end loop;

  return saved_id;
end
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security (ARCHITECTURE §6.5)
-- ---------------------------------------------------------------------------
-- (RLS itself was switched on right after each table was created.)

-- Admins: everything. Depot managers: everything (their receipts may list a
-- product deactivated since). Distributors: active products only, the ones
-- they may collect (PRD-07).
create policy "products: read by role"
  on public.products for select
  to authenticated
  using (
    public.is_admin()
    or public.current_app_role() = 'depot_manager'
    or (public.current_app_role() = 'distributor' and status = 'active')
  );

-- A unit is visible exactly when its product is: the subquery runs under the
-- products policy above for the same caller.
create policy "product_units: read with product"
  on public.product_units for select
  to authenticated
  using (exists (select 1 from public.products p where p.id = product_units.product_id));

revoke all on table public.products from public, anon, authenticated;
revoke all on table public.product_units from public, anon, authenticated;
grant select on table public.products to authenticated;
grant select on table public.product_units to authenticated;

revoke all on function public.admin_save_product(uuid, text, text, text, public.record_status, integer, integer)
  from public, anon;
grant execute on function public.admin_save_product(uuid, text, text, text, public.record_status, integer, integer)
  to authenticated;
