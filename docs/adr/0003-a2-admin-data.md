# ADR 0003 — A2 Admin data: technical choices

**Status:** Accepted for A2 (A2a, A2b and A2c merged; the owner signed off A2 on 2026-10-04, including choices #9, #10 and #20 to #24)
**Date:** 2026-10-02

## Context

A2 adds the master data the admin manages: products (A2a), depots (A2b) and users (A2c). The business rules come from REQUIREMENTS §5.2–5.4 and owner decision Q-57. This record lists the technical choices the build needed. None of them change business behaviour.

## Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | **One database function per save** (`admin_save_product`). It creates or edits a product and its units in one transaction, then writes the audit log. | ARCHITECTURE §6.1: rules that protect the numbers live in Postgres. A single call cannot leave a product half-saved, for example with its name changed but its units not. |
| 2 | **Units are sent as loaves only** (`pack_loaves`, `caisse_loaves`, or null when not used). The form converts "N Packs" to loaves before saving. | PRD-05 says the system stores loaves. The database never needs to know how the admin typed the value. |
| 3 | **Editing opens the form directly** at `/admin/products/:id`. There is no separate product detail page. | A product has nothing else to show yet. A detail page can be added when history needs one. |
| 4 | **Admin screens load on demand** (route `lazy`). The loading bar shows meanwhile (Q-56). | PERF-1/PERF-2: the first download stays small; initial JS is 185.5 KB of 250 KB. |
| 5 | **Description optional** (Q-57j), added as a second small migration (`20261002131000_a2a_description_optional.sql`) instead of editing the first. A blank description is stored as empty (null) by a trigger. | The owner changed the rule after the first A2a file may already have been run on staging. A separate file works either way. |
| 6 | **No react-hook-form** yet (T-1 approved). Forms use plain React state and the pure checks in `src/domain/`. | The product form has one conditional block. Revisit if forms grow. |
| 7 | **Migration files under 100 lines**, one SQL function per file at most. The products migration is split in three parts, with a small private helper `save_product_units()`. | Pasting a longer file into the Supabase SQL editor was cut off at line 100 three times, which broke the function body ("unterminated dollar-quoted string"). Short files paste whole. |
| 8 | **The depot link lives on the account** (`profiles.depot_id`), with a unique index allowing one *active* manager per depot. `admin_save_depot` assigns the manager through a private helper `assign_depot_manager()`, which deactivates the replaced manager in the same transaction (Q-57c). | USR-03: a manager belongs to one depot. The index makes "two active managers at one depot" impossible even if the app is wrong. |
| 9 | **A depot that has a manager keeps one**, until it is made inactive (Q-58c, #24). The form offers "No manager" only for a depot without one; to change manager the admin picks another. `manager_id` null means "keep as is". | No rule says a depot can lose its manager without a replacement. Deactivating the manager's account (A2c) is the way to remove them. **Confirmed by the owner, 2026-10-02.** |
| 10 | **Choosing a manager who runs another depot moves them**; that depot is left without a manager. The form says so before saving ("Ann will move here. Akwa will have no manager."). | Follows from one depot per manager (USR-03). The warning lets the admin cancel. **Confirmed by the owner, 2026-10-02.** |
| 11 | **Phone numbers stored as `+237XXXXXXXXX`** in a `text[]` column, checked by `is_cameroon_phone_list()`. The form accepts spaces and an optional +237, and shows them grouped. | Q-57i. One stored form makes numbers comparable and tap-to-call works. |
| 12 | **Back may name the page's own parameters** (`/admin/depots/:depotId`), filled from the URL. Edit depot goes back to that depot's page. | Q-56: Back moves one step up inside the tab. |

| 13 | **Account writes run in Vercel Functions** under `api/admin/users*` (create, edit, reset password), as Web `Request`/`Response` handlers. Shared logic is in `api/_lib/`. Relative imports there end in `.js`. The folder is type-checked by `tsconfig.node.json`, linted, tested and measured for coverage like `src/`. | ARCHITECTURE §6.6 and Q-43. Creating a login and setting a password need Supabase's secret server key, which exists only on the server (SEC-4). No new package: the functions use `@supabase/supabase-js` and `zod`. |
| 14 | **Every function checks the caller first:** it asks Supabase whose login the token is, then confirms an active admin profile, before touching anything. The database functions `admin_save_user()` and `admin_record_password_reset()` run only for the server's key (execute revoked from the API roles) and check "active admin" again. | SEC-1: nothing the browser says about its role is trusted, and a mistake in the function cannot bypass the rules. |
| 15 | **A new login is created first, then its profile.** If the database refuses the profile, the login is deleted again. A changed email is set in Supabase Auth first; if the database then refuses, the old email is put back. | `profiles.id` must match an existing login. This keeps the login and the profile in step. |
| 16 | **`profiles.phones text[]`** (same check as depots) replaces the unused `phone` column. The old column is kept, unused: dropping it needs the owner's approval (DB-4). | Q-57i: one or more phone numbers. |
| 17 | **The audit log names the admin who acted.** `assign_depot_manager()` has a version that takes the admin as an argument; the A2b two-argument version now calls it with `auth.uid()`. | The server key has no signed-in user, so `auth.uid()` is empty there (AUD-02). |
| 18 | **Passwords: the app adds no rule.** The admin types the temporary password twice. Supabase's password policy decides what is too weak, and its refusal is shown in words. The longest accepted is 72 characters. | `domain/validation.ts`: strength is left to Supabase. Nothing is emailed (Q-57a, Q-57b). |
| 19 | **Users have no detail page.** A card opens the edit page (`/admin/users/:userId/edit`), which ends with the "Reset password" form. | ARCHITECTURE §4.2 lists only the list, new and edit routes. |

### Choices for the owner to confirm (A2c)

| # | Choice | Reason |
|---|---|---|
| 20 | **Only an active depot manager has a depot.** Deactivating a manager, or giving them another role, takes them off the depot, and the form says which depot is left without a manager. Reactivating a manager needs a depot. | Q-57c already deactivates a *replaced* manager and requires a depot on reactivation; USR-03 says an account has a depot only if it is a manager. This applies the same rule to every deactivation. |
| 21 | **The "last active admin" rule only blocks an admin from changing their own role.** The person asking is always an active admin, so for anyone else another active admin exists. Deactivating yourself is always refused. | USR-06 / Q-57f. |
| 22 | **A deactivated account's existing sign-in is not cut off in Supabase Auth.** It gets no data (the database treats an inactive account as having no role, AUTH-09) and the app refuses it when it checks the account. | Keeps deactivation to one switch. Banning the login in Auth as well can be added if you want it. |
| 23 | **Inactive depots are not offered to a depot manager** (owner decision Q-58a, replaces the first version of this choice). The form lists active depots only. The database refuses an inactive depot for a manager: a trigger on `profiles` (migration `…150500`) keeps the rule even outside the save functions. | Owner: an inactive depot must not be visible for giving to a manager. |
| 24 | **Saving a depot as inactive deactivates its manager** and takes them off the depot, the same way a replaced manager is handled (Q-57c). The depot form hides the manager list for an inactive depot and warns first: "Ann Manager will be deactivated and will no longer run this depot." A manager cannot be chosen for an inactive depot. Reactivating the depot gives it no manager. Migration `…150600` replaces `admin_save_depot()`; `…150500` also adds that trigger and cleans up any manager still at an inactive depot. | Owner decision Q-58c: an inactive depot has no manager. USR-03 says only an active manager has a depot, so the manager cannot stay active without one. The alternative is to refuse deactivating a depot until its manager is moved or deactivated first. |

## Consequences

- Run the A2c migrations (`…150000` to `…150600`, there is no `…150400`) the same way, and check the Vercel environment has `SUPABASE_SERVICE_ROLE_KEY` for Preview and Production (docs/SETUP.md §4a).
- Run the A2b migrations (`…140000`, `…140100`, `…140200`) the same way.
- Run the A2a migrations in name order (`…130000`, `…130100`, `…130200`, `…131000`) on **staging** to try the A2a preview, and on **production** after the pull request merges (docs/SETUP.md §4, DB-3).
