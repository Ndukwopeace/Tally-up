-- -----------------------------------------------------------------------------
-- A3a (operational data), part 3 of 6: depot confirmations and counts.
--
-- WHY:  The depot manager's physical count is the third fact (REQUIREMENTS §1).
--       It is stored apart from what the distributor recorded, so neither ever
--       overwrites the other (REC-03). One line may have several counts in
--       different units, e.g. 2 Caisse + 5 Packs (RCP-06).
-- HOW:  `confirmations` (one per hand-over, RCP-12) and `confirmation_counts`.
--       Append-only; no API writes. Visible to whoever can see the hand-over.
-- WHEN: Run once per project, after part 2.
-- SECURITY: The manager's submit function (DM1) will check the receipt belongs to
--       their depot; here there is no write path at all.
-- -----------------------------------------------------------------------------
create table public.confirmations (
  id uuid primary key default gen_random_uuid(),
  -- RULE RCP-12: a receipt is confirmed once, then locked.
  distribution_id uuid not null unique references public.distributions (id) on delete restrict,
  manager_id uuid not null references public.profiles (id) on delete restrict,
  -- RULE RCP-09: optional, never required.
  comment text,
  confirmed_at timestamptz not null default now()
);
alter table public.confirmations enable row level security;

create table public.confirmation_counts (
  id uuid primary key default gen_random_uuid(),
  confirmation_id uuid not null references public.confirmations (id) on delete restrict,
  distribution_item_id uuid not null references public.distribution_items (id) on delete restrict,
  unit public.product_unit not null,
  -- RULE RCP-07: zero and any whole number above are allowed.
  quantity integer not null check (quantity >= 0),
  loaves_per_unit_snapshot integer not null check (loaves_per_unit_snapshot > 0),
  check (unit <> 'Loaf' or loaves_per_unit_snapshot = 1),
  -- RULE RCP-06: one entry per unit for each line.
  unique (confirmation_id, distribution_item_id, unit)
);
alter table public.confirmation_counts enable row level security;
create index confirmation_counts_item_idx on public.confirmation_counts (distribution_item_id);

create policy "confirmations: read with the distribution" on public.confirmations for select to authenticated
  using (exists (select 1 from public.distributions d where d.id = distribution_id));
create policy "confirmation_counts: read with the confirmation" on public.confirmation_counts for select to authenticated
  using (exists (select 1 from public.confirmations c where c.id = confirmation_id));

revoke all on table public.confirmations, public.confirmation_counts from public, anon, authenticated;
grant select on table public.confirmations, public.confirmation_counts to authenticated;
