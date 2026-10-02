-- -----------------------------------------------------------------------------
-- A2a (Admin data), part 2 of 3: save_product_units(), used by part 3.
--
-- WHY:  Keeps admin_save_product() short; this sets one product's units.
-- HOW:  Loaf is always 1 (Q-57d). Pack and Caisse are set, changed, or removed
--       when null (not used). Past records keep their own snapshot of
--       loaves-per-unit, so changes affect only new records (PRD-06).
-- WHEN: Run once per project, after part 1 and before part 3.
-- SECURITY: Not callable through the API (execute revoked from every API
--       role). Only admin_save_product(), which checks for an active admin,
--       calls it.
-- -----------------------------------------------------------------------------
create function public.save_product_units(saved_id uuid, pack_loaves integer, caisse_loaves integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- One wanted unit: the enum's values (Loaf, Pack, Caisse) paired by position
  -- with their loaves (Loaf is never null, so it is always kept).
  unit_row record;
begin
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
end
$$;

revoke all on function public.save_product_units(uuid, integer, integer) from public, anon, authenticated;
