-- -----------------------------------------------------------------------------
-- A2a database tests: products, their units, and admin_save_product().
--
-- WHY:  Product units and loaves-per-unit decide every quantity in the app
--       (PRD-03 to PRD-05). The database must refuse a product without its
--       Loaf unit, a zero conversion, a duplicate code, or a save by anyone
--       but an active admin (SEC-1, SEC-12), and record each change (AUD-03).
-- HOW:  pgTAP inside one rolled-back transaction, same helpers as the A1 test:
--       users are inserted as the superuser, then each check "signs in" by
--       setting the JWT claims and switching to the `authenticated` role.
-- WHEN: scripts/db-test.sh (npm run db:test) and the CI `db-test` job.
-- SECURITY: Fictional users only; everything is rolled back.
-- -----------------------------------------------------------------------------
begin;
select plan(30);

-- ---------------------------------------------------------------------------
-- Helpers (pg_temp: exist only for this test session).
-- ---------------------------------------------------------------------------
create function pg_temp.fixture_id(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(to_hex(n), 12, '0'))::uuid
$$;
create function pg_temp.admin_user() returns uuid language sql immutable as $$ select pg_temp.fixture_id(20) $$;
create function pg_temp.distributor_user() returns uuid language sql immutable as $$ select pg_temp.fixture_id(21) $$;
create function pg_temp.manager_user() returns uuid language sql immutable as $$ select pg_temp.fixture_id(22) $$;

create function pg_temp.sign_in_as(uid uuid) returns void language plpgsql as $$
begin
  reset role;
  if uid is null then
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
end $$;

-- Saves a product as the signed-in caller; returns its id.
create function pg_temp.save(product_id uuid, product_code text, pack int, caisse int, active boolean)
returns uuid language sql as $$
  select public.admin_save_product(product_id, 'Bread ' || product_code, product_code, 'Test bread',
    case when active then (enum_range(null::public.record_status))[1] else (enum_range(null::public.record_status))[2] end,
    pack, caisse)
$$;

-- Loaves per unit for one product, as text like "Caisse=50,Loaf=1,Pack=10".
create function pg_temp.units_of(product_id uuid) returns text language sql as $$
  select string_agg(unit::text || '=' || loaves_per_unit, ',' order by unit::text)
  from public.product_units where product_units.product_id = units_of.product_id
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email)
select id, id || '@example.test'
from unnest(array[pg_temp.admin_user(), pg_temp.distributor_user(), pg_temp.manager_user()]) as id;

insert into public.profiles (id, full_name, email, role)
select id, 'Person', id || '@example.test', (enum_range(null::public.app_role))[role_position]
from (values (pg_temp.admin_user(), 1), (pg_temp.distributor_user(), 2), (pg_temp.manager_user(), 3))
  as fixture (id, role_position);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------
select enum_has_labels('public', 'product_unit', array['Loaf', 'Pack', 'Caisse'], 'RULE PRD-03: Loaf, Pack, Caisse');
select ok((select relrowsecurity from pg_class where oid = 'public.products'::regclass), 'RLS on products');
select ok((select relrowsecurity from pg_class where oid = 'public.product_units'::regclass), 'RLS on product_units');

-- ---------------------------------------------------------------------------
-- Admin creates and edits products
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as(pg_temp.admin_user());

create temp table saved (label text primary key, id uuid);
grant all on saved to authenticated;
insert into saved values ('big', pg_temp.save(null, 'BB-01', 10, 50, true));

select is(pg_temp.units_of((select id from saved where label = 'big')), 'Caisse=50,Loaf=1,Pack=10',
  'PRD-04: Loaf (always 1), Pack and Caisse are stored in loaves');

insert into saved values ('loaf_only', pg_temp.save(null, 'LO-1', null, null, true));
select is(pg_temp.units_of((select id from saved where label = 'loaf_only')), 'Loaf=1',
  'Q-57d: every product has the Loaf unit, even with no Pack or Caisse');

insert into saved values ('caisse_only', pg_temp.save(null, 'CO-1', null, 24, true));
select is(pg_temp.units_of((select id from saved where label = 'caisse_only')), 'Caisse=24,Loaf=1',
  'PRD-03: Pack is optional; Caisse can be set in loaves');

select throws_ok($$select pg_temp.save(null, 'bb-01', null, null, true)$$, 'P0001', 'CODE_TAKEN',
  'PRD-02 / Q-57h: product codes are unique ignoring letter case');
select throws_ok($$select pg_temp.save(null, 'BAD CODE', null, null, true)$$, 'P0001', 'INVALID_PRODUCT',
  'Q-57h: code allows letters, numbers and dashes only');
select throws_ok($$select pg_temp.save(null, 'ABCDEFGHIJKLMNOPQRSTU', null, null, true)$$, 'P0001', 'INVALID_PRODUCT',
  'Q-57h: code is at most 20 characters');
select throws_ok($$select pg_temp.save(null, 'P0', 0, null, true)$$, 'P0001', 'INVALID_PRODUCT',
  'PRD-04: loaves per Pack must be at least 1');
select throws_ok($$select pg_temp.save(null, 'C0', null, -5, true)$$, 'P0001', 'INVALID_PRODUCT',
  'PRD-04: loaves per Caisse must be at least 1');
select throws_ok(
  $$select public.admin_save_product(null, '  ', 'NB-1', 'x', 'active', null, null)$$, 'P0001', 'INVALID_PRODUCT',
  'PRD-02: name is required');
select throws_ok(
  $$select public.admin_save_product(null, 'No description', 'ND-1', ' ', 'active', null, null)$$, 'P0001',
  'INVALID_PRODUCT', 'PRD-02: description is required');

-- Edit: drop Caisse, change Pack, deactivate.
select lives_ok($$select pg_temp.save((select id from saved where label = 'big'), 'BB-01', 12, null, false)$$,
  'an admin edits a product');
select is(pg_temp.units_of((select id from saved where label = 'big')), 'Loaf=1,Pack=12',
  'PRD-06: units can change; a removed unit disappears, Loaf stays');
select is((select status::text from public.products where id = (select id from saved where label = 'big')),
  'inactive', 'PRD-01: deactivated, not deleted');
select is((select code from public.products where id = (select id from saved where label = 'big')), 'BB-01',
  'the code keeps the letters as typed');
select throws_ok($$select pg_temp.save(gen_random_uuid(), 'ZZ-1', null, null, true)$$, 'P0001', 'NOT_FOUND',
  'editing a product that does not exist is refused');

-- ---------------------------------------------------------------------------
-- Audit (AUD-03): created, edited, deactivated
-- ---------------------------------------------------------------------------
reset role;
select results_eq(
  format($$select action from public.audit_log where record_id = %L order by created_at, action$$,
         (select id from saved where label = 'big')::text),
  $$values ('product.created'), ('product.deactivated'), ('product.edited')$$,
  'AUD-03: product created, edited and deactivated are logged');
select is((select user_id from public.audit_log where action = 'product.created' limit 1), pg_temp.admin_user(),
  'AUD-02: the log says which admin did it');

-- ---------------------------------------------------------------------------
-- Who can see and change products (ARCHITECTURE §6.5)
-- ---------------------------------------------------------------------------
select pg_temp.sign_in_as(pg_temp.distributor_user());
select is((select count(*)::int from public.products), 2,
  'distributors see active products only (one of three is inactive)');
select is((select count(*)::int from public.product_units), 3,
  'distributors see units of active products only');
select throws_ok($$select pg_temp.save(null, 'DX-1', null, null, true)$$, 'P0001', 'NOT_ADMIN',
  'SECURITY: a distributor cannot save products');
select throws_ok($$insert into public.products (name, code, description) values ('x', 'X-1', 'x')$$, '42501', null,
  'SECURITY: nobody writes products directly');
select throws_ok($$update public.product_units set loaves_per_unit = 99$$, '42501', null,
  'SECURITY: nobody changes loaves-per-unit directly');

select pg_temp.sign_in_as(pg_temp.manager_user());
select is((select count(*)::int from public.products), 3, 'depot managers see every product (past receipts)');

select pg_temp.sign_in_as(null);
select throws_ok('select count(*) from public.products', '42501', null, 'signed-out visitors see no products');
select throws_ok($$select pg_temp.save(null, 'AN-1', null, null, true)$$, '42501', null,
  'signed-out visitors cannot call the save function');

select pg_temp.sign_in_as(pg_temp.admin_user());
select is((select count(*)::int from public.products), 3, 'an admin sees every product');
select throws_ok($$delete from public.products$$, '42501', null, 'PRD-01: no hard delete');

select * from finish();
rollback;
