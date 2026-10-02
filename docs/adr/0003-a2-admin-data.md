# ADR 0003 — A2 Admin data: technical choices

**Status:** Proposed (grows with the A2a, A2b and A2c pull requests; accepted when the owner merges each one)
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
| 9 | **A depot that has a manager keeps one.** The form offers "No manager" only for a depot without one; to change manager the admin picks another. `manager_id` null means "keep as is". | No rule says a depot can lose its manager without a replacement. Deactivating the manager's account (A2c) is the way to remove them. |
| 10 | **Choosing a manager who runs another depot moves them**; that depot is left without a manager. The form says so before saving ("Ann will move here. Akwa will have no manager."). | Follows from one depot per manager (USR-03). The warning lets the admin cancel. |
| 11 | **Phone numbers stored as `+237XXXXXXXXX`** in a `text[]` column, checked by `is_cameroon_phone_list()`. The form accepts spaces and an optional +237, and shows them grouped. | Q-57i. One stored form makes numbers comparable and tap-to-call works. |
| 12 | **Back may name the page's own parameters** (`/admin/depots/:depotId`), filled from the URL. Edit depot goes back to that depot's page. | Q-56: Back moves one step up inside the tab. |

## Consequences

- Run the A2b migrations (`…140000`, `…140100`, `…140200`) the same way.
- Run the A2a migrations in name order (`…130000`, `…130100`, `…130200`, `…131000`) on **staging** to try the A2a preview, and on **production** after the pull request merges (docs/SETUP.md §4, DB-3).
