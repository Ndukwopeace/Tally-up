-- -----------------------------------------------------------------------------
-- A2c (Admin data: users), part 1 of 4: phone numbers on accounts.
--
-- WHY:  An account may have one or more phone numbers, all optional, all valid
--       Cameroon numbers (USR-02, Q-57i). A1 created a single `phone` column
--       that nothing has ever written.
-- HOW:  Adds `phones text[]` with the same check depots use
--       (is_cameroon_phone_list). Copies a valid old `phone` into it. The old
--       column stays, unused: dropping a column needs the owner's approval (DB-4).
-- WHEN: Run once per project, after the A2b files and before parts 2 to 4.
-- SECURITY: No new grant or policy. `phones` is read under the same rules as
--       the rest of the profile (own row; admins read all) and written only by
--       admin_save_user() (part 4).
-- -----------------------------------------------------------------------------

-- RULE Q-57i: stored as +237 then 9 digits starting with 2 or 6.
alter table public.profiles
  add column phones text[] not null default '{}' check (public.is_cameroon_phone_list(phones));

-- Keeps any number that was set by hand before; others are dropped rather than guessed at.
update public.profiles set phones = array[phone] where phone ~ '^\+237[26][0-9]{8}$';

comment on column public.profiles.phone is 'Unused since A2c; replaced by phones. Kept: dropping needs owner approval (DB-4).';
