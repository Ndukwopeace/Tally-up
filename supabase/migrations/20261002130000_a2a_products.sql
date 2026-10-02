-- -----------------------------------------------------------------------------
-- A2a (Admin data), part 1 of 3: product tables and who may read them.
--
-- WHY:  Every quantity is counted in a product's units and converted to
--       loaves, the base unit (PRD-03 to PRD-05, Q-57d). Nothing is hard-coded.
-- HOW:  `product_unit` enum; `products`; `product_units` (loaves per unit,
--       Loaf always 1); RLS read policies. Writes go only through
--       admin_save_product() (part 3). Files are kept under 100 lines so they
--       copy into the Supabase SQL editor in one piece.
-- WHEN: Run once per project after A1, then parts 2 and 3 (staging first, DB-3).
-- SECURITY: No API role can insert, update or delete these tables. Admins
--       read all; distributors read active products; depot managers read all.
-- -----------------------------------------------------------------------------

-- RULE PRD-03: the three units. Loaf is the base unit.
create type public.product_unit as enum ('Loaf', 'Pack', 'Caisse');

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

-- SECURITY: RLS on straight after the table (the SQL editor checks for this).
alter table public.products enable row level security;

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

alter table public.product_units enable row level security;

-- Admins: everything. Depot managers: everything (their receipts may list a
-- product deactivated since). Distributors: active products only (PRD-07).
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
