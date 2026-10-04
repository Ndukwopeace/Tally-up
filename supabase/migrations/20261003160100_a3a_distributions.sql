-- -----------------------------------------------------------------------------
-- A3a (operational data), part 2 of 6: hand-overs (distributions) and their lines.
--
-- WHY:  A distribution is one hand-over from one collection to one depot
--       (REQUIREMENTS §3, DIS-01 to DIS-10). It is also the receipt the depot
--       manager confirms, so its number is shown the same to everyone (Q-39).
-- HOW:  `distributions` (DIS-00001) and `distribution_items`, each line with its
--       own unit and loaves-per-unit snapshot (DIS-04: the unit may differ from
--       the collected unit). Append-only, no API writes. Reads: admin all; a
--       distributor their own; a depot manager their depot's (§6.5).
-- WHEN: Run once per project, after part 1.
-- SECURITY: `distributor_id` repeats the collection's distributor on purpose, to
--       keep RLS simple (§9). Over-distribution (DIS-06) is checked by the D1
--       submit function, not here.
-- -----------------------------------------------------------------------------
create sequence public.distribution_number_seq;

create table public.distributions (
  id uuid primary key default gen_random_uuid(),
  -- RULE Q-39: DIS-00018 style, one global sequence.
  number integer not null unique default nextval('public.distribution_number_seq'),
  label text generated always as ('DIS-' || lpad(number::text, 5, '0')) stored,
  collection_id uuid not null references public.collections (id) on delete restrict,
  depot_id uuid not null references public.depots (id) on delete restrict,
  distributor_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.distributions enable row level security;
create index distributions_collection_idx on public.distributions (collection_id);
create index distributions_depot_idx on public.distributions (depot_id, created_at desc);

create table public.distribution_items (
  id uuid primary key default gen_random_uuid(),
  distribution_id uuid not null references public.distributions (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  unit public.product_unit not null,
  -- RULE DIS-05: zero lines are not saved, so a line is always above zero.
  quantity integer not null check (quantity > 0),
  loaves_per_unit_snapshot integer not null check (loaves_per_unit_snapshot > 0),
  check (unit <> 'Loaf' or loaves_per_unit_snapshot = 1),
  unique (distribution_id, product_id, unit)
);
alter table public.distribution_items enable row level security;

create policy "distributions: read by role" on public.distributions for select to authenticated
  using (
    public.is_admin()
    or (public.current_app_role() = 'distributor' and distributor_id = auth.uid())
    or (public.current_app_role() = 'depot_manager' and depot_id = public.current_depot_id())
  );
create policy "distribution_items: read with the distribution" on public.distribution_items for select to authenticated
  using (exists (select 1 from public.distributions d where d.id = distribution_id));

revoke all on table public.distributions, public.distribution_items from public, anon, authenticated;
revoke all on sequence public.distribution_number_seq from public, anon, authenticated;
grant select on table public.distributions, public.distribution_items to authenticated;
