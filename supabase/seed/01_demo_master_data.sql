-- -----------------------------------------------------------------------------
-- Staging test data, step 1: depots, products and people.
--
-- WHY:  Realistic master data for the A3 screens (Q-59b): the spec's depots
--       (Akwa, Bonaberi, Makepe) and breads (Big Bread, Small Bread, Milk Bread),
--       2 distributors and 3 depot managers.
-- HOW:  Demo ids start with "de" so 00_reset_demo.sql can remove exactly these
--       rows. Names end in "(demo)" and emails end in @demo.tallyup.test, so they
--       are never mistaken for real data. The accounts have no password, so they
--       cannot sign in. Big Bread: 1 Pack = 10, 1 Caisse = 50 loaves; Small Bread:
--       20 and 120; Milk Bread: 12 and 60.
-- WHEN: Run in the STAGING SQL editor after 00, then 02 to 05.
-- SECURITY: Fictional. NEVER run on production (DB-5).
-- -----------------------------------------------------------------------------
create or replace function pg_temp.demo_id(kind int, n bigint) returns uuid language sql immutable as $$
  select ('de' || lpad(to_hex(kind), 6, '0') || '-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid
$$;

insert into public.depots (id, name, location, address, phones) values
  (pg_temp.demo_id(1, 1), 'Akwa (demo)', 'Douala', 'Near Akwa market', array['+237677000001']),
  (pg_temp.demo_id(1, 2), 'Bonaberi (demo)', 'Douala', 'Bonaberi port road', array[]::text[]),
  (pg_temp.demo_id(1, 3), 'Makepe (demo)', 'Douala', 'Makepe roundabout', array['+237233000003']);

insert into public.products (id, name, code, description) values
  (pg_temp.demo_id(2, 1), 'Big Bread (demo)', 'DEMO-BIG', 'Big loaf'),
  (pg_temp.demo_id(2, 2), 'Small Bread (demo)', 'DEMO-SMALL', 'Small loaf'),
  (pg_temp.demo_id(2, 3), 'Milk Bread (demo)', 'DEMO-MILK', 'Sweet milk loaf');

insert into public.product_units (product_id, unit, loaves_per_unit)
select pg_temp.demo_id(2, p), u.unit::public.product_unit, case u.unit when 'Loaf' then 1 when 'Pack' then pk else ca end
from (values (1, 10, 50), (2, 20, 120), (3, 12, 60)) as prod (p, pk, ca)
cross join (values ('Loaf'), ('Pack'), ('Caisse')) as u (unit);

-- Users 1 and 2 are distributors; 3, 4 and 5 run Akwa, Bonaberi and Makepe.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data)
select pg_temp.demo_id(3, n), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  email, '', now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{}'
from (values (1, 'distributor1@demo.tallyup.test'), (2, 'distributor2@demo.tallyup.test'),
  (3, 'manager.akwa@demo.tallyup.test'), (4, 'manager.bonaberi@demo.tallyup.test'),
  (5, 'manager.makepe@demo.tallyup.test')) as person (n, email);

insert into public.profiles (id, full_name, email, role, status, depot_id)
select pg_temp.demo_id(3, n), name, email, role::public.app_role, 'active',
  case when n > 2 then pg_temp.demo_id(1, n - 2) end
from (values
  (1, 'Demo Distributor One', 'distributor1@demo.tallyup.test', 'distributor'),
  (2, 'Demo Distributor Two', 'distributor2@demo.tallyup.test', 'distributor'),
  (3, 'Demo Manager Akwa', 'manager.akwa@demo.tallyup.test', 'depot_manager'),
  (4, 'Demo Manager Bonaberi', 'manager.bonaberi@demo.tallyup.test', 'depot_manager'),
  (5, 'Demo Manager Makepe', 'manager.makepe@demo.tallyup.test', 'depot_manager')
) as person (n, name, email, role);
