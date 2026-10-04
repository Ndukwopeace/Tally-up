-- -----------------------------------------------------------------------------
-- A3a (operational data), part 1 of 6: collections and their lines.
--
-- WHY:  A collection is what one distributor picked up from the bakery (REQUIREMENTS
--       §3, COL-01 to COL-07). Admin monitoring (A3) reads these records; the
--       distributor's submit function arrives with D1.
-- HOW:  `collections` with a global number (COL-00001, §11) and `collection_items`
--       with the loaves-per-unit snapshot taken at submit (PRD-06). Rows are
--       append-only: no API role can insert, update or delete (AUD-01, COR-02).
--       Reads follow ARCHITECTURE §6.5: admin all, a distributor their own.
-- WHEN: Run once per project, after the A2c files, then parts 2 to 6.
-- SECURITY: RLS on straight after each table. Test data is inserted by the
--       database owner (supabase/seed/, staging only, DB-5).
-- -----------------------------------------------------------------------------
create sequence public.collection_number_seq;

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  -- RULE §11: one global sequence, shown as COL-00001.
  number integer not null unique default nextval('public.collection_number_seq'),
  label text generated always as ('COL-' || lpad(number::text, 5, '0')) stored,
  distributor_id uuid not null references public.profiles (id) on delete restrict,
  -- RULE COL-06 / NFR-10: set by the server, stored in UTC.
  created_at timestamptz not null default now()
);
alter table public.collections enable row level security;
create index collections_distributor_idx on public.collections (distributor_id, created_at desc);

create table public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  unit public.product_unit not null,
  -- RULE COL-05 / Q-20: a whole number above zero.
  quantity integer not null check (quantity > 0),
  -- RULE PRD-06: the conversion frozen at submit time; a Loaf is always 1.
  loaves_per_unit_snapshot integer not null check (loaves_per_unit_snapshot > 0),
  check (unit <> 'Loaf' or loaves_per_unit_snapshot = 1),
  -- RULE COL-04: the same product in the same unit twice is blocked.
  unique (collection_id, product_id, unit)
);
alter table public.collection_items enable row level security;

create policy "collections: read by role" on public.collections for select to authenticated
  using (public.is_admin() or (public.current_app_role() = 'distributor' and distributor_id = auth.uid()));
-- A line is visible exactly when its collection is (the subquery is filtered by the policy above).
create policy "collection_items: read with the collection" on public.collection_items for select to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id));

-- SECURITY: no INSERT, UPDATE or DELETE grant for any API role (SEC-2).
revoke all on table public.collections, public.collection_items from public, anon, authenticated;
revoke all on sequence public.collection_number_seq from public, anon, authenticated;
grant select on table public.collections, public.collection_items to authenticated;
