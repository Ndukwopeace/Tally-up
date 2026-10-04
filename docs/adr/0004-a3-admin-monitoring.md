# ADR 0004 — A3 Admin monitoring: technical choices

**Status:** Proposed (grows with the A3a, A3b and A3c pull requests; accepted when the owner signs A3 off)
**Date:** 2026-10-04

## Context

A3 lets the admin answer the core question from the screen: what was collected, where was it distributed, and did each depot confirm it (REQUIREMENTS §1). The business rules come from REQUIREMENTS §5.5 to §5.10, §5.12, §5.13 and owner decision Q-59. This record lists the technical choices the build needed. None change business behaviour.

## Decisions (A3a: operational data and test data)

| # | Decision | Reason |
|---|---|---|
| 1 | **The operational tables are created in A3, read-only.** `collections`, `collection_items`, `distributions`, `distribution_items`, `confirmations`, `confirmation_counts`, `corrections` and `notifications` have no insert, update or delete grant for any API role. Test data is inserted by the database owner. The functions that write them (`submit_collection`, `submit_distribution`, `confirm_receipt`) arrive with D1 and DM1; `admin_correct` and `mark_notifications_read` with A3c. | ARCHITECTURE §6.1, §6.4: no hard delete, no direct writes (AUD-01, COR-02). Building the tables now lets A3 show real-shaped data without building the other roles' screens. |
| 2 | **Child tables are visible when their parent is.** The policies on lines, confirmations and counts say "a parent row I can see exists". A correction is visible when the record it corrects is. So each role's rule is written once, on `collections` and `distributions`. | ARCHITECTURE §6.5. Fewer places for a rule to drift. Tested for every role (SEC-12). |
| 3 | **Views compute everything, and apply corrections.** `v_latest_corrections` keeps the newest correction per field; `v_*_effective` give the quantity in force and whether it was corrected; `v_collection_product_balance`, `v_collection_status`, `v_receipt_line` and `v_receipt_status` are built on them. All use `security_invoker`, so Row Level Security still applies to whoever reads them. | REC-01, REC-02, COL-08, RCP-11, COR-05: Remaining, Difference and both statuses are computed, never stored (§9). |
| 4 | **Record numbers come from Postgres sequences,** `COL-00001` and `DIS-00001`, in a generated `label` column. The prefix and the five digits are repeated in SQL because the database must build them; `business-rules.ts` has the same values for display. | REQUIREMENTS §11, Q-39. |
| 5 | **The same sums exist in TypeScript** (`src/domain/units.ts`, `balances.ts`) and are tested with the same spec numbers as the views (1,000 collected, 700 handed over, 300 remaining; 2 Caisse + 5 Packs against 3 Caisse; 95 against 100). | ENGINEERING §4 (DRY): once in TypeScript, once in SQL, and tests prove they agree. |
| 6 | **Test data lives in `supabase/seed/`, not `migrations/`.** Six files under 100 lines (reset, then steps 1 to 5), run by hand in the staging SQL editor. Every demo row has an id starting with `de`, so the reset deletes exactly those rows. Names end in "(demo)", emails in `@demo.tallyup.test`, and the accounts have no password. Dates are built around today (Douala time), and choices depend on date order, so a reset rebuilds the same data. `supabase/tests/a3a_seed.test.sql` runs the real files and checks the result. | Q-59b, DB-5: fictional, staging only, never production. The SQL editor cuts off text after line 100. |
| 7 | **The test stub of Supabase's `auth.users` has more columns** (`aud`, `role`, `encrypted_password`, token columns and others, all nullable). The seed fills them the way Supabase expects, because listing logins can fail when the token columns are null. | The seed inserts into `auth.users` so the demo accounts can have profiles. The database tests run the real seed files. |

## Consequences

- Run the A3a migrations (`…160000` to `…160500`) on **staging** first, then **production**, the same way as before (docs/SETUP.md §4).
- Run the seed files only on **staging** (docs/SETUP.md §7). They have not been run on a real Supabase project from the build environment: the first run is yours.
- A correction is readable by the distributor or manager who can read the corrected record, including the admin's optional note (ARCHITECTURE §6.5). No screen shows it to them before D1 and DM1.
- A3b (screens) and A3c (corrections, notifications, audit log, settings) add their own decisions to this record.
