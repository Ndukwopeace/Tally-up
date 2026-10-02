-- -----------------------------------------------------------------------------
-- A2a (Admin data), part 3 of 3: admin_save_product(), the only write path.
--
-- WHY:  One call creates or edits a product and its units, and logs it (AUD-03).
-- HOW:  target_product_id null = create. pack_loaves / caisse_loaves: loaves
--       in one Pack / Caisse, null when unused (the form converts packs to
--       loaves first, PRD-05). Raises NOT_ADMIN, NOT_FOUND, CODE_TAKEN or
--       INVALID_PRODUCT, which the app shows in plain words.
-- WHEN: Run once per project, after parts 1 and 2.
-- SECURITY: Checks the caller is an active admin before anything else; takes
--       no user id, so the audit entry always names the real caller.
-- -----------------------------------------------------------------------------
create function public.admin_save_product(
  target_product_id uuid,
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
declare
  saved_id uuid;
  old_status public.record_status;
  -- record_type of every audit entry written here.
  record_kind constant text := 'product';
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN';
  end if;
  -- RULE PRD-04: a Pack or Caisse holds at least one loaf.
  if coalesce(pack_loaves, 1) < 1 or coalesce(caisse_loaves, 1) < 1 then
    raise exception 'INVALID_PRODUCT';
  end if;

  begin
    if target_product_id is null then
      insert into public.products (name, code, description, status)
      values (btrim(product_name), btrim(product_code), btrim(product_description), product_status)
      returning id into saved_id;
      insert into public.audit_log (user_id, action, record_type, record_id, details)
      values (auth.uid(), 'product.created', record_kind, saved_id::text, jsonb_build_object('code', btrim(product_code)));
    else
      select p.status into old_status from public.products p where p.id = target_product_id for update;
      if not found then
        raise exception 'NOT_FOUND';
      end if;
      update public.products
      set name = btrim(product_name), code = btrim(product_code),
          description = btrim(product_description), status = product_status
      where id = target_product_id;
      saved_id := target_product_id;
      -- RULE AUD-03: edited, and (de)activated when the status changed.
      insert into public.audit_log (user_id, action, record_type, record_id)
      values (auth.uid(), 'product.edited', record_kind, saved_id::text);
      if old_status <> product_status then
        insert into public.audit_log (user_id, action, record_type, record_id)
        values (auth.uid(), 'product.' || case when product_status = 'inactive' then 'deactivated' else 'activated' end,
                record_kind, saved_id::text);
      end if;
    end if;
  exception
    -- Another product already uses this code (unique index on lower(code)).
    when unique_violation then
      raise exception 'CODE_TAKEN';
    -- Blank name, bad code format or a null value.
    when check_violation or not_null_violation then
      raise exception 'INVALID_PRODUCT';
  end;

  perform public.save_product_units(saved_id, pack_loaves, caisse_loaves);
  return saved_id;
end
$$;

revoke all on function public.admin_save_product(uuid, text, text, text, public.record_status, integer, integer)
  from public, anon;
grant execute on function public.admin_save_product(uuid, text, text, text, public.record_status, integer, integer)
  to authenticated;
