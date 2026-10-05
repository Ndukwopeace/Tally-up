# ADR 0005 — MVP write functions: technical choices

**Status:** Proposed (accepted when the owner signs the MVP off)
**Date:** 2026-10-05

## Context

After A3a and A3b the admin can read operations but nobody can create them: no collection, hand-over or count exists except the staging seed. Q-60 puts the Distributor and Depot Manager portals next, in a minimal form, and the write functions first (ARCHITECTURE §6.4).

## Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | **Three functions are the only write paths:** `submit_collection`, `submit_distribution`, `confirm_receipt`. They are `SECURITY DEFINER` with an empty search path. The caller is `auth.uid()`; no user id comes from the request. Tables keep no INSERT grant. | SEC-1, SEC-2, AUD-01: the browser cannot write operations any other way, and cannot pretend to be someone else. |
| 2 | **One shared check of lines, `read_lines()`,** used by all three. It reads the JSON, and raises `INVALID_ITEMS`, `INVALID_QUANTITY` or `DUPLICATE_LINE`. It has no grant to any API role. | The same rules apply to collections, hand-overs and counts; written once (DRY). Raw database messages never reach the app. |
| 3 | **Errors are short codes** (`NOT_DISTRIBUTOR`, `OVER_DISTRIBUTION`, `COUNT_MISSING`, …), the same style as the A2 functions. The app maps each to plain words. | Consistency with `admin_save_product`; no technical text on screen (NFR-07). |
| 4 | **`submit_distribution` locks the collection row** (`select … for update`) before it reads Remaining, then compares per product in loaves. `confirm_receipt` locks the hand-over row. The lock makes two phones, or a double tap, wait and then see the first result. | DIS-06, RCP-12, COL-09. Not covered by a test: pgTAP runs in one transaction, so concurrency is by design, not by proof. |
| 5 | **The loaves per unit are copied from the product at the moment of the call** into the new lines and counts. | PRD-06: later changes to a product never change recorded history. |
| 6 | **Every line of a receipt must be counted** (`COUNT_MISSING` otherwise); zero is a valid count; a count may exceed what was recorded. | RCP-04, RCP-07. A missing count is never read as a match. |
| 7 | **Audit rows are written** (`collection_created`, `distribution_submitted`, `receipt_confirmed`, `discrepancy_detected`). **Notifications are not.** | AUD-03. NOT-01 to NOT-04 are deferred (Q-60); the audit screen waits too, but nothing is lost. |
| 8 | **A depot manager's confirmation is allowed for an inactive depot they still manage** (same as reading, DEP-06); a hand-over to an inactive depot is refused. | DEP-03, DEP-06, Q-58. |

## Consequences

- Run the four `20261005…` migrations on **staging**, then **production** (docs/SETUP.md §4), in file order.
- 67 new pgTAP checks cover the rules and the role refusals. Not covered: real concurrency, and a real Supabase project (only a plain Postgres stand-in was used).
- D1 and DM1 call these functions through new services; the mock versions apply the same rules in TypeScript, so a test of a page matches the database.
