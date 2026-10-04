-- -----------------------------------------------------------------------------
-- A3a (operational data), part 4 of 6: corrections and notifications.
--
-- WHY:  An admin may correct quantities and a comment, but a correction never
--       overwrites (COR-01, COR-02): it keeps the original, the new value, who
--       and when. Notifications tell people what needs attention (NOT-01 to NOT-05).
-- HOW:  `corrections` as a separate table. A correction can be read by whoever can
--       read the record it corrects (§6.5); the check borrows the other tables'
--       policies by looking the record up. `notifications` are read by their owner.
--       Neither table has an API write path; admin_correct() and
--       mark_notifications_read() come with A3c.
-- WHEN: Run once per project, after part 3.
-- SECURITY: Only the four correctable record kinds are accepted (COR-01).
-- -----------------------------------------------------------------------------
create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  target_table text not null
    check (target_table in ('collection_items', 'distribution_items', 'confirmation_counts', 'confirmations')),
  target_id uuid not null,
  -- RULE COR-01: quantities, and the confirmation's comment.
  field text not null check (field in ('quantity', 'comment')),
  original_value text not null,
  corrected_value text not null,
  admin_id uuid not null references public.profiles (id) on delete restrict,
  note text,
  created_at timestamptz not null default now(),
  check ((target_table = 'confirmations') = (field = 'comment'))
);
alter table public.corrections enable row level security;
create index corrections_target_idx on public.corrections (target_table, target_id, field, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  type text not null check (length(type) > 0),
  record_type text,
  record_id text,
  message text not null check (length(message) > 0),
  -- RULE NOT-05: read or unread.
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- A correction is visible when the record it corrects is visible to the caller.
create policy "corrections: read with the corrected record" on public.corrections for select to authenticated
  using (
    public.is_admin()
    or (target_table = 'collection_items' and exists (select 1 from public.collection_items t where t.id = target_id))
    or (target_table = 'distribution_items' and exists (select 1 from public.distribution_items t where t.id = target_id))
    or (target_table = 'confirmation_counts' and exists (select 1 from public.confirmation_counts t where t.id = target_id))
    or (target_table = 'confirmations' and exists (select 1 from public.confirmations t where t.id = target_id))
  );
-- RULE NOT-05: everyone reads only their own notifications.
create policy "notifications: read own" on public.notifications for select to authenticated
  using (user_id = auth.uid());

revoke all on table public.corrections, public.notifications from public, anon, authenticated;
grant select on table public.corrections, public.notifications to authenticated;
