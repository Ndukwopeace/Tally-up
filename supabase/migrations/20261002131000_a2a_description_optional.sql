-- -----------------------------------------------------------------------------
-- A2a follow-up: a product's description is optional (owner decision Q-57j).
--
-- WHY:  After seeing the product form, the owner decided Description need not
--       be filled in. The first A2a migration made it required.
-- HOW:  A separate file rather than an edit of 20261002130000_a2a_products.sql,
--       so it works whether or not that file was already run on staging:
--       - the column may be empty (null);
--       - a trigger turns a blank description ("" or spaces) into null before
--         saving, so "no description" is stored one way only.
--       admin_save_product() is unchanged: it trims the text, and the trigger
--       does the rest.
-- WHEN: Run once per project, right after 20261002130000_a2a_products.sql.
-- SECURITY: No change to who may read or write products.
-- -----------------------------------------------------------------------------

-- RULE Q-57j: no description is allowed.
alter table public.products alter column description drop not null;
alter table public.products drop constraint products_description_check;

-- Stores a blank description as null, so "empty" has one meaning.
create function public.products_blank_description_to_null()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.description is not null and btrim(new.description) = '' then
    new.description := null;
  end if;
  return new;
end
$$;

-- BEFORE: runs ahead of the table's checks, on every insert and edit.
create trigger products_blank_description_to_null
  before insert or update of description on public.products
  for each row
  execute function public.products_blank_description_to_null();

-- Trigger functions are never called directly by the API.
revoke all on function public.products_blank_description_to_null() from public, anon, authenticated;
