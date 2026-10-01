# Tally-Up — Requirements Document

**Status:** DRAFT v0.1 — awaiting owner review
**Date:** 2026-10-01
**Source:** "TALLY-UP — Bakery Distribution Tracking System" specification (58 sections)

No code will be written until the open questions in Section 12 are answered or accepted.
Every item marked **[PROPOSED]** is a suggestion, not a decision. If you do not accept it, it changes.

---

## 1. Purpose

Tally-Up records three facts and compares them:

1. What a distributor **collected** from the bakery.
2. What the distributor **gave to each depot**.
3. What each depot manager **physically counted** on arrival.

The owner reads the result without phoning anyone.

Core question every feature must serve:
> What did the distributor collect, where was it distributed, and did each depot confirm receiving it?

## 2. Out of Scope

The following will not be built. Not as stubs, not as placeholders, not as "future" menu items.

Truck management, truck capacity, truck registration, GPS, route optimisation, driver tracking, fuel, vehicle maintenance, warehouse manager role/portal, customer deliveries, customer accounts, retail sales, resellers, commissions, cash collection, invoices, payments, online ordering, production management, payroll, AI features, public signup.

The app will not ask why a collection happened (hot bread, late batch, full truck). It records it.

## 3. Glossary

| Term | Meaning |
|---|---|
| Collection | One pickup event by one distributor. Many per day allowed. |
| Collection Item | One product + unit + quantity inside a collection. |
| Distribution | One handover from one collection to one depot. Creates one Receipt. |
| Distribution Item | Product + unit + quantity given to that depot. |
| Receipt | The depot-side view of a distribution. Same record, depot manager's perspective. |
| Confirmation | The depot manager's physical count, comment, and timestamp. Locked once submitted. |
| Remaining | Collected − Distributed, per product per unit. |
| Discrepancy | Any confirmation line where Confirmed ≠ Recorded. |

## 4. Roles

Exactly three. No others.

| Role | Device focus | Scope of data |
|---|---|---|
| Admin / Owner | Desktop-first, responsive | Everything |
| Distributor | Mobile-first | Own collections, own distributions, their receipts' status |
| Depot Manager | Mobile-first | Only the assigned depot's receipts |

A distributor is not tied to any depot. Any active distributor may distribute to any active depot.

---

## 5. Functional Requirements

IDs are stable. Later commits and tests will reference them.

### 5.1 Authentication & Access

| ID | Requirement |
|---|---|
| AUTH-01 | Routes `/login` and `/forgot-password`. No signup route. |
| AUTH-02 | Accounts are created only by an Admin. |
| AUTH-03 | Login identifier: email or phone. Secret: password or PIN. *(See Q-12.)* |
| AUTH-04 | After login, route by role: Admin → `/admin`, Distributor → `/distributor`, Depot Manager → `/depot`. |
| AUTH-05 | Route guards block a role from another portal's URLs, including typed URLs. Redirect to own portal. |
| AUTH-06 | Deactivated users cannot log in. |
| AUTH-07 | Every data request is filtered by role and ownership in the data layer, not only in the UI. Data access is written so it maps directly to Supabase Row Level Security policies. |

### 5.2 Products (Admin)

| ID | Requirement |
|---|---|
| PRD-01 | Create, edit, activate/deactivate products. No hard delete. |
| PRD-02 | Fields: Name, Code (unique), Description, Image (optional), Supported Units, Unit Conversions, Status. |
| PRD-03 | Supported units are chosen per product from: Loaf, Pack, Caisse. At least one required. |
| PRD-04 | Conversions are optional and stored per product (e.g. `1 Pack = N Loaf`). No global conversion values exist anywhere in code. |
| PRD-05 | With no conversion configured, units are treated as independent. The system never infers one. |
| PRD-06 | Inactive products cannot be added to new collections. |

### 5.3 Depots (Admin)

| ID | Requirement |
|---|---|
| DEP-01 | Create, edit, activate/deactivate depots. No hard delete. |
| DEP-02 | Fields: Name, Location, Address/Description, Phone (optional), Assigned Manager, Status. |
| DEP-03 | Admin assigns a Depot Manager to a depot. *(See Q-3 on one vs. many managers.)* |
| DEP-04 | Depot detail page shows its distribution/receipt history. |
| DEP-05 | Inactive depots do not appear in the distributor's depot picker. |

### 5.4 Users (Admin)

| ID | Requirement |
|---|---|
| USR-01 | Admin creates, edits, activates/deactivates Distributor and Depot Manager accounts. |
| USR-02 | Fields: Full Name, Phone, Email (optional), Role, Assigned Depot (Depot Manager only), Status. |
| USR-03 | A Depot Manager account requires a depot. A Distributor account has no depot field. |
| USR-04 | Admin can reset a user's access (set a new password/PIN). |

### 5.5 Collections (Distributor)

| ID | Requirement |
|---|---|
| COL-01 | Flow: New Collection → Add Products → Review → Submit → "Collection Recorded" → Start Distribution. |
| COL-02 | Each row: Product, Unit (limited to that product's supported units), Quantity. |
| COL-03 | Multiple rows allowed. "Add Product" adds a row. |
| COL-04 | The same product + unit pair cannot appear twice in one collection. *(See Q-21.)* |
| COL-05 | Quantity: whole number, greater than zero. *(See Q-20.)* |
| COL-06 | Timestamp is set by the system on submit. Not user-editable. |
| COL-07 | A distributor may create any number of collections per day. Each is its own record with its own ID. |
| COL-08 | Status is computed, never set by hand: **In Progress** if any line has Remaining > 0; **Fully Distributed** when every line has Remaining = 0. |
| COL-09 | Submit button disables while processing. Double submission is prevented. |

### 5.6 Distributions (Distributor)

| ID | Requirement |
|---|---|
| DIS-01 | Distributor picks one of their own In Progress collections and sees the available (Remaining) quantity per product per unit. |
| DIS-02 | Distributor picks any active depot. |
| DIS-03 | Distributor enters a "Give" quantity per line. Remaining updates live as they type. |
| DIS-04 | Lines left empty or zero are excluded. At least one line must be > 0. |
| DIS-05 | **Over-distribution is blocked**, per product per unit. Message: "Only {n} {unit} are available for distribution." Validated on the client and again in the data layer. |
| DIS-06 | Review screen before submit. |
| DIS-07 | On submit: distribution is saved, its receipt status is **Awaiting Confirmation**, and the depot manager is notified. |
| DIS-08 | Success screen shows depot, products, receipt status, updated remaining quantities, and buttons "Distribute to Another Depot" and "Back to Dashboard". |
| DIS-09 | Distribution units must match collection units. No conversion during distribution. *(See Q-1.)* |
| DIS-10 | Distributor can list their past distributions with receipt status (Awaiting / Confirmed / Confirmed with Discrepancy). |
| DIS-11 | Distributor cannot confirm, edit, or view the editing controls of any depot confirmation. |

### 5.7 Receipt Confirmation (Depot Manager)

| ID | Requirement |
|---|---|
| RCP-01 | Dashboard leads with Pending Receipts for the manager's depot only. |
| RCP-02 | Receipt screen header: Depot, Distributor, Date, Time, Receipt ID. |
| RCP-03 | "Distributor Recorded" section: Product, Unit, Quantity (read-only). |
| RCP-04 | "Your Count" section: one numeric field per line. Fields start **empty**, not pre-filled with the distributor's number. *(See Q-9.)* |
| RCP-05 | Count accepts zero and any whole number ≥ 0. Count may exceed the recorded quantity. |
| RCP-06 | "Comment (Optional)" field always visible. Never required, with or without a discrepancy. |
| RCP-07 | Review screen shows per line: Recorded, Counted, Difference, and ✓ Match or ⚠ Difference. Shows comment. Shows text: "Once confirmed, this receipt cannot be edited." |
| RCP-08 | System computes status. **Confirmed** if every line matches. **Confirmed with Discrepancy** if any line differs. The manager never picks a status. No "Dispute" button exists. |
| RCP-09 | After submit, quantities, comment, and status are locked for the manager. |
| RCP-10 | Distributor and Admin are notified of the result. |
| RCP-11 | Manager can view their depot's receipt history. |

### 5.8 Reconciliation Rules

| ID | Rule |
|---|---|
| REC-01 | Per collection line: `Collected = Distributed + Remaining`. |
| REC-02 | Per receipt line: `Difference = Confirmed − Recorded`. |
| REC-03 | Recorded and Confirmed are stored in separate fields/tables. One never overwrites the other. |
| REC-04 | Reconciliation is per product per unit. Totals are never used as a substitute. |
| REC-05 | Collection status (distribution completeness) and receipt status (depot verification) are independent. A collection can be Fully Distributed while one of its receipts is Confirmed with Discrepancy. |

### 5.9 Admin Corrections

| ID | Requirement |
|---|---|
| COR-01 | Admin may correct a locked confirmation quantity or comment. |
| COR-02 | A correction never overwrites. It stores: original value, corrected value, admin, timestamp, optional note. |
| COR-03 | UI shows corrected values with a visible "Corrected" marker and the history behind it. |
| COR-04 | Whether Admin may also correct collection or distribution quantities is **not decided**. *(See Q-11.)* |

### 5.10 Admin Monitoring

| ID | Requirement |
|---|---|
| ADM-01 | Dashboard KPI cards: Collected Today, Distributed Today, Remaining to Distribute, Awaiting Confirmation (count), Confirmed Receipts (count), Discrepancies (count). *(See Q-7 on adding mixed units.)* |
| ADM-02 | Today's Activity: list of today's collections with ID, distributor, time, collected, distributed, remaining, status. Each opens a detail page. |
| ADM-03 | Collection detail: ID, distributor, date, time, lines (product/unit/qty), distributed, remaining, status; then Depot Allocations grouped by depot with receipt status. Each receipt opens. |
| ADM-04 | Discrepancies page: date, distributor, depot, product, unit, recorded qty, confirmed qty, difference, comment, confirmation time. Discrepancies are never hidden or auto-cleared. |
| ADM-05 | Admin does not need to take part in normal transactions. |

### 5.11 Reports & Export

| ID | Requirement |
|---|---|
| RPT-01 | Filters: single date, date range, depot, product, distributor, receipt status, discrepancy yes/no. |
| RPT-02 | Reports answer: collected per day, distributed per day, received per depot, distributor per distribution, products per depot, receipts with discrepancies, recorded vs confirmed totals. |
| RPT-03 | Export uses exactly the filtered dataset on screen. |
| RPT-04 | Formats: CSV and PDF. *(See Q-24 on what ships in v1.)* |

### 5.12 History & Audit

| ID | Requirement |
|---|---|
| AUD-01 | All operational records are permanent. No hard delete of collections, distributions, confirmations, corrections. |
| AUD-02 | Audit log entry: user, action, timestamp, affected record type and ID. |
| AUD-03 | Logged actions (minimum): collection created; distribution submitted; receipt confirmed; discrepancy detected; admin correction; user/depot/product created, edited, (de)activated; manager assigned to depot; access reset. |
| AUD-04 | Admin can view and filter the audit log. |
| AUD-05 | History visibility: Admin — all. Distributor — own. Depot Manager — own depot only. |

### 5.13 Notifications (in-app)

| ID | Trigger | Recipient | Text |
|---|---|---|---|
| NOT-01 | Distribution submitted | Depot's manager | "New distribution awaiting confirmation." |
| NOT-02 | Receipt confirmed, no discrepancy | Distributor | "{Depot} confirmed your distribution." |
| NOT-03 | Receipt confirmed with discrepancy | Distributor | "{Depot} confirmed with a discrepancy." |
| NOT-04 | Receipt confirmed with discrepancy | Admin | "Distribution discrepancy detected at {Depot}." |
| NOT-05 | — | — | Read/unread state. Notification sending goes through one service so push can be added later without changing callers. |

---

## 6. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | Stack: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, Lucide, TanStack Query. |
| NFR-02 | Data access behind service interfaces. v1 uses an in-memory/localStorage mock implementation with realistic seed data. A Supabase implementation replaces it later without UI changes. |
| NFR-03 | Folder separation: `pages`, `components`, `layouts`, `services`, `hooks`, `types`, `auth`, `lib/utils`. No single-file app. |
| NFR-04 | PWA: installable manifest and service worker for app shell. |
| NFR-05 | No fake sync. Any write not confirmed by the data layer shows as "Pending sync", never as saved. |
| NFR-06 | Every data screen has loading (skeleton), empty, error, and success states. |
| NFR-07 | Mobile portals: bottom nav, large tap targets (≥ 44px), numeric keypad on quantity inputs, sticky primary action, cards not tables. |
| NFR-08 | Admin portal: left sidebar on desktop, drawer on mobile, tables on desktop, cards on mobile. |
| NFR-09 | Timestamps shown in human format (e.g. "Today, 9:42 AM"). Stored in UTC. Displayed in the business time zone. *(See Q-6.)* |
| NFR-10 | Consistent status badges across all portals (one component, one colour per status). |

## 7. Navigation

**Admin (sidebar):** Dashboard · Collections · Distributions · Discrepancies · Depots · Products · Users · Reports · Notifications · Settings
**Distributor (bottom):** Dashboard · Collections · Distributions · History · Profile
**Depot Manager (bottom):** Dashboard · Receipts · History · Profile

Settings (Admin) holds only items from Section 11 (configurable assumptions). Nothing else is invented for it.

## 8. Status Values

| Entity | Values | Set by |
|---|---|---|
| Collection | In Progress, Fully Distributed | Computed |
| Receipt | Awaiting Confirmation, Confirmed, Confirmed with Discrepancy | Computed |
| User / Depot / Product | Active, Inactive | Admin |

## 9. Data Model

```
User (id, full_name, phone, email?, role, depot_id?, status, created_at)
Depot (id, name, location, address, phone?, status, created_at)
Product (id, name, code, description, image_url?, status)
ProductUnit (id, product_id, unit[Loaf|Pack|Caisse])
UnitConversion (id, product_id, from_unit, to_unit, factor)

Collection (id, number, distributor_id, created_at)
CollectionItem (id, collection_id, product_id, unit, quantity)

DepotDistribution (id, number, collection_id, depot_id, distributor_id, created_at)
DepotDistributionItem (id, distribution_id, collection_item_id, quantity)

DepotConfirmation (id, distribution_id, manager_id, comment?, confirmed_at)
DepotConfirmationItem (id, confirmation_id, distribution_item_id, confirmed_quantity)

Correction (id, target_table, target_id, field, original_value, corrected_value, admin_id, note?, created_at)
Notification (id, user_id, type, record_type, record_id, message, read_at?, created_at)
AuditLog (id, user_id, action, record_type, record_id, details_json, created_at)
```

Design notes:
- Remaining, Distributed, Difference, and both statuses are **computed**, not stored. They cannot drift out of sync.
- `DepotDistributionItem` points at a `CollectionItem`, so product and unit come from the collection line. This enforces DIS-09 by structure.
- `Correction` is a separate table. Original rows are never updated in place.
- `DepotDistribution.distributor_id` duplicates the collection's distributor to make depot-manager queries and RLS simple. This is the only intended duplication.

## 10. Validation Summary

- Quantities: whole numbers only, no negatives, no text.
- Collection quantity > 0. Distribution quantity ≥ 0 (zero means "not included"). Count quantity ≥ 0.
- Distribution ≤ Remaining, per product per unit, checked twice (UI and data layer).
- Confirmation allowed once per receipt.
- All submit buttons disable while processing.
- Final actions (submit collection, submit distribution, confirm receipt) go through a review screen.

## 11. Configurable Assumptions

The spec says: if a rule is missing, isolate it as config, do not hard-code policy. These live in one file (`src/config/business-rules.ts`) and, where useful, in Admin → Settings.

| Key | Default proposed | Why it is config |
|---|---|---|
| `businessTimeZone` | `Africa/Douala` | Defines "today". Depot names suggest Douala; not confirmed. |
| `allowDecimalQuantities` | `false` | Spec does not say. |
| `countFieldsPrefilled` | `false` | Pre-filling invites lazy confirmation. |
| `distributorCanCancelUnconfirmedDistribution` | `false` | Spec does not say. |
| `maxManagersPerDepot` | `1` | Spec implies one. |
| `collectionNumberFormat` | `COL-{seq:5}` global | Spec shows "#001" with no reset rule. |
| `distributionNumberFormat` | `RCP-{seq:5}` global | Same. |
| `staleCollectionHours` | `24` | When an In Progress collection is flagged to Admin. Spec does not say. |

---

## 12. Open Questions

These are gaps or conflicts in the source spec. My proposed answer is in the right column. Reply with **Accept**, or give your answer.

| # | Question | Proposed answer |
|---|---|---|
| Q-1 | Can a distributor collect in Caisse and hand over in Packs (using a conversion)? | **No.** Distribute in the unit collected. Conversions are stored and displayed for reference only in v1. |
| Q-2 | Can a depot manager count in a different unit than the distributor recorded? | **No.** Same unit as the recorded line. |
| Q-3 | One manager per depot, or several? | **One** active manager per depot. Reassigning replaces the previous one. |
| Q-4 | If a manager is replaced, does the new manager see the depot's past receipts? | **Yes.** Visibility follows the depot, not the person. |
| Q-5 | Can a distributor edit or cancel a collection or distribution after submitting? | **No.** Mistakes go to Admin for correction. |
| Q-6 | Which time zone defines "today"? | `Africa/Douala` (WAT, UTC+1). |
| Q-7 | "Collected Today" adds loaves + packs + caisse into one number, which is meaningless. | Show the KPI **broken down by unit** (e.g. "4,200 Loaves · 310 Packs · 45 Caisse"). No converted grand total. |
| Q-8 | A receipt sits unconfirmed for days. Does anything happen? | **Nothing automatic.** It stays Awaiting Confirmation and shows its age to Admin. |
| Q-9 | Should "Your Count" fields start empty or pre-filled with the distributor's number? | **Empty.** Forces an actual count. |
| Q-10 | Can the manager report a product that arrived but was not on the receipt? | **No** in v1. They can mention it in the comment. |
| Q-11 | Can Admin correct collection and distribution quantities too, not only confirmations? | **Yes**, with the same correction trail, but a correction that would make Distributed > Collected is blocked. |
| Q-12 | Login: email or phone? Password or PIN? | Phone **or** email + **password** for all roles. |
| Q-13 | Forgot password: many users may have no email, and SMS is a paid service. | `/forgot-password` shows "Contact your administrator." Admin resets it. Email reset added with Supabase later. |
| Q-14 | Can there be more than one Admin? Who creates Admins? | **Multiple** allowed. Admins can create other Admins. First Admin seeded at setup. |
| Q-15 | Product deactivated while still on an In Progress collection: can it still be distributed? | **Yes.** Deactivation only blocks new collections. |
| Q-16 | Depot deactivated with Awaiting receipts: can its manager still confirm? | **Yes.** Existing receipts can be confirmed. No new distributions to it. |
| Q-17 | Distributor deactivated with an In Progress collection. | Collection stays as-is, visible to Admin. Nobody else can distribute from it. |
| Q-18 | Is there an "abandon" path for leftover stock that will never be distributed? | **No** — the spec forbids unexplained balances. Collection stays In Progress and is flagged to Admin after `staleCollectionHours` (config, default 24h). |
| Q-19 | Interface language: English only, or English + French? | **English only** in v1, with text kept in one place so French can be added. |
| Q-20 | Whole numbers only? | **Yes.** |
| Q-21 | Same product in two units on one collection (e.g. Big Bread 500 Loaves + 10 Caisse)? | **Allowed** as two separate lines. Same product + same unit twice is merged/blocked. |
| Q-22 | Offline transactions in v1? | **No.** Online only. Architecture leaves room. Offline screens show a clear "No connection" state. |
| Q-23 | v1 runs on mock data, Supabase later? | **Yes.** v1 = full UI on mock data. Supabase is phase 2. |
| Q-24 | Exports: both PDF and CSV in v1? | **CSV in v1.** PDF in phase 2 (behind the same export interface). |
| Q-25 | Product images: where stored in v1? | URL field only in v1. Upload added with Supabase Storage. |
| Q-26 | Should Admin also see notifications for every new distribution (not only discrepancies)? | **No.** Only NOT-04, per the spec. |

## 13. Delivery Plan

Each phase ends with a commit, a push to the working branch, and your sign-off before the next starts.

| Phase | Content | Done when |
|---|---|---|
| 0 | This document. | You approve it and answer Section 12. |
| 1 | Project scaffold, types, mock data layer, auth + route guards, three empty portal layouts with navigation. | You can log in as each role and cannot reach other portals. |
| 2 | Admin: Products, Depots, Users. | Master data can be created and deactivated. |
| 3 | Distributor: Collections, Distributions, balances, over-distribution block. | Section 3 example (800 → 250/300/250) works end to end. |
| 4 | Depot Manager: pending receipts, count, review, lock. | Section 57 example workflow works end to end. |
| 5 | Admin: Dashboard, Today, Collection detail, Discrepancies, Corrections, Audit, Notifications. | Owner can answer the core question from the screen. |
| 6 | Reports, filters, CSV export, PWA manifest/service worker. | Filtered export matches screen. |
| 7 | Supabase backend + RLS (separate approval). | Mock layer swapped, UI unchanged. |

## 14. Working Rules for the Build

- Nothing outside this document gets built.
- If a phase hits a gap not covered here, work stops on that point and the question comes to you.
- No repository-level destructive actions (force push, branch deletion, history rewrite).
- All work goes to branch `claude/practical-ritchie-mnkli1`.
