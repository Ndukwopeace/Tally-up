# Tally-Up — Requirements Document

**Status:** DRAFT v0.2 — owner answers to round 1 applied; open questions remain
**Date:** 2026-10-01
**Source:** "TALLY-UP — Bakery Distribution Tracking System" specification (58 sections)

No code will be written until the open questions in Section 12 are answered or accepted.
Every item marked **[PROPOSED]** is a suggestion, not a decision. Items marked **[DECIDED]** come from the owner.

---

## 1. Purpose

Tally-Up records three facts and compares them:

1. What a distributor **collected** from the bakery.
2. What the distributor **gave to each depot** (distributed / handed over).
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
| Distribution (= hand-over) | One hand-over from one collection to one depot. Creates one Receipt. |
| Distribution Item | Product + unit + quantity given to that depot. The unit may differ from the collected unit (see 5.6). |
| Receipt | The depot-side view of a distribution. Same record, depot manager's perspective. |
| Confirmation | The depot manager's physical count, comment, and timestamp. Locked once submitted. |
| Remaining | Collected − Distributed, per product. |
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
| AUTH-03 | **[DECIDED]** Login with **email + password**. |
| AUTH-04 | **[DECIDED]** "Continue with Google" option on the login screen. **[PROPOSED]** Google sign-in only succeeds if the Google email matches an active account an Admin already created. Any other Google account is refused with "No Tally-Up account exists for this email. Contact your administrator." *(See Q-31, Q-32.)* |
| AUTH-05 | After login, route by role: Admin → `/admin`, Distributor → `/distributor`, Depot Manager → `/depot`. |
| AUTH-06 | Route guards block a role from another portal's URLs, including typed URLs. Redirect to own portal. |
| AUTH-07 | Deactivated users cannot log in, by password or by Google. |
| AUTH-08 | Every data request is filtered by role and ownership in the data layer, not only in the UI. Data access is written so it maps directly to Supabase Row Level Security policies. |

### 5.2 Products (Admin)

| ID | Requirement |
|---|---|
| PRD-01 | Create, edit, activate/deactivate products. No hard delete. |
| PRD-02 | Fields: Name, Code (unique), Description, Image (optional), Supported Units, Unit Conversions, Status. |
| PRD-03 | Supported units are chosen per product from: Loaf, Pack, Caisse. At least one required. |
| PRD-04 | Conversions are optional and stored per product (e.g. `1 Pack = N Loaf`, `1 Caisse = N Pack`). Factors are whole numbers. No global conversion values exist anywhere in code. |
| PRD-05 | With no conversion configured, units are treated as independent. The system never infers one. |
| PRD-06 | Inactive products cannot be added to new collections. |

### 5.3 Depots (Admin)

| ID | Requirement |
|---|---|
| DEP-01 | Create, edit, activate/deactivate depots. No hard delete. |
| DEP-02 | Fields: Name, Location, Address/Description, Phone (optional), Assigned Manager, Status. |
| DEP-03 | **[DECIDED]** One Depot Manager per depot. Assigning a new manager replaces the previous one. |
| DEP-04 | Depot detail page shows its distribution/receipt history. |
| DEP-05 | Inactive depots do not appear in the distributor's depot picker. |

### 5.4 Users (Admin)

| ID | Requirement |
|---|---|
| USR-01 | Admin creates, edits, activates/deactivates Distributor and Depot Manager accounts. |
| USR-02 | Fields: Full Name, **Email (required — it is the login)**, Phone, Role, Assigned Depot (Depot Manager only), Status. |
| USR-03 | A Depot Manager account requires a depot. A Distributor account has no depot field. |
| USR-04 | Admin can reset a user's password. |

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
| COL-08 | Status is computed, never set by hand: **In Progress** if any product has Remaining > 0; **Fully Distributed** when every product has Remaining = 0. |
| COL-09 | Submit button disables while processing. Double submission is prevented. |
| COL-10 | **[DECIDED]** After submit, the distributor cannot edit or cancel the collection. |

### 5.6 Distributions (Distributor)

| ID | Requirement |
|---|---|
| DIS-01 | Distributor picks one of their own In Progress collections and sees the available (Remaining) quantity per product. |
| DIS-02 | Distributor picks any active depot. |
| DIS-03 | Distributor enters a "Give" quantity per line. Remaining updates live as they type. |
| DIS-04 | Lines left empty or zero are excluded. At least one line must be > 0. |
| DIS-05 | **[DECIDED]** The distributed unit may differ from the collected unit (e.g. collected in Caisse, handed over in Packs). |
| DIS-06 | **[PROPOSED]** A different unit is offered only when the product has a conversion path between the two units (e.g. Caisse → Pack, or Caisse → Pack → Loaf). With no conversion configured, only the collected unit is offered. This follows the spec rule "never invent a conversion". |
| DIS-07 | **Over-distribution is blocked.** Quantities are compared per product after converting to that product's smallest configured unit. Message: "Only {n} {unit} are available for distribution." Validated on the client and again in the data layer. |
| DIS-08 | Review screen before submit. |
| DIS-09 | On submit: distribution is saved, its receipt status is **Awaiting Confirmation**, and the depot manager is notified. |
| DIS-10 | Success screen shows depot, products, receipt status, updated remaining quantities, and buttons "Distribute to Another Depot" and "Back to Dashboard". |
| DIS-11 | **[DECIDED]** After submit, the distributor cannot edit or cancel the distribution. |
| DIS-12 | Distributor can list their past distributions with receipt status (Awaiting / Confirmed / Confirmed with Discrepancy). |
| DIS-13 | Distributor cannot confirm, edit, or see editing controls for any depot confirmation. |

### 5.7 Receipt Confirmation (Depot Manager)

| ID | Requirement |
|---|---|
| RCP-01 | Dashboard leads with Pending Receipts for the manager's depot only. |
| RCP-02 | Receipt screen header: Depot, Distributor, Date, Time, Receipt ID. |
| RCP-03 | "Distributor Recorded" section: Product, Unit, Quantity (read-only). |
| RCP-04 | **[DECIDED]** "Your Count" fields start **empty**. The manager must type each count. |
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
| REC-01 | Per collection, per product: `Collected = Distributed + Remaining`, measured in the product's smallest configured unit. |
| REC-02 | Per receipt line: `Difference = Confirmed − Recorded`, in the unit on that receipt line. |
| REC-03 | Recorded and Confirmed are stored in separate fields/tables. One never overwrites the other. |
| REC-04 | Reconciliation is per product. Totals across products are never used as a substitute. |
| REC-05 | Collection status (distribution completeness) and receipt status (depot verification) are independent. A collection can be Fully Distributed while one of its receipts is Confirmed with Discrepancy. |

### 5.9 Admin Corrections

| ID | Requirement |
|---|---|
| COR-01 | Admin may correct a locked confirmation quantity or comment. |
| COR-02 | A correction never overwrites. It stores: original value, corrected value, admin, timestamp, optional note. |
| COR-03 | UI shows corrected values with a visible "Corrected" marker and the history behind it. |
| COR-04 | Since distributors cannot edit (COL-10, DIS-11), Admin correction is the only fix for a distributor's mistake. Whether Admin may correct collection and distribution quantities is **not decided**. *(See Q-11.)* |

### 5.10 Admin Monitoring

| ID | Requirement |
|---|---|
| ADM-01 | Dashboard KPI cards: Collected Today, Distributed Today, Remaining to Distribute, Awaiting Confirmation (count), Confirmed Receipts (count), Discrepancies (count). |
| ADM-02 | **[DECIDED]** Quantity KPIs show **per unit** (e.g. "4,200 Loaves · 310 Packs · 45 Caisse"). No converted grand total. |
| ADM-03 | Today's Activity: list of today's collections with ID, distributor, time, collected, distributed, remaining, status. Each opens a detail page. |
| ADM-04 | Collection detail: ID, distributor, date, time, lines (product/unit/qty), distributed, remaining, status; then Depot Allocations grouped by depot with receipt status. Each receipt opens. |
| ADM-05 | Discrepancies page: date, distributor, depot, product, unit, recorded qty, confirmed qty, difference, comment, confirmation time. Discrepancies are never hidden or auto-cleared. |
| ADM-06 | Admin does not need to take part in normal transactions. |

### 5.11 Reports & Export

| ID | Requirement |
|---|---|
| RPT-01 | Filters: single date, date range, depot, product, distributor, receipt status, discrepancy yes/no. |
| RPT-02 | Reports answer: collected per day, distributed per day, received per depot, distributor per distribution, products per depot, receipts with discrepancies, recorded vs confirmed totals. |
| RPT-03 | Export uses exactly the filtered dataset on screen. |
| RPT-04 | **[DECIDED]** **PDF export first.** CSV/Excel added later through the same export interface. |

### 5.12 History & Audit

| ID | Requirement |
|---|---|
| AUD-01 | All operational records are permanent. No hard delete of collections, distributions, confirmations, corrections. |
| AUD-02 | Audit log entry: user, action, timestamp, affected record type and ID. |
| AUD-03 | Logged actions (minimum): login (password or Google); collection created; distribution submitted; receipt confirmed; discrepancy detected; admin correction; user/depot/product created, edited, (de)activated; manager assigned to depot; password reset. |
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
| NFR-02 | Data access behind service interfaces. v1 uses a mock implementation with realistic seed data. A Supabase implementation replaces it later without UI changes. *(See Q-32 on Google sign-in.)* |
| NFR-03 | Folder separation: `pages`, `components`, `layouts`, `services`, `hooks`, `types`, `auth`, `lib/utils`. No single-file app. |
| NFR-04 | PWA: installable manifest and service worker for app shell. |
| NFR-05 | No fake sync. Any write not confirmed by the data layer shows as "Pending sync", never as saved. |
| NFR-06 | Every data screen has loading (skeleton), empty, error, and success states. |
| NFR-07 | Mobile portals: bottom nav, large tap targets (≥ 44px), numeric keypad on quantity inputs, sticky primary action, cards not tables. |
| NFR-08 | Admin portal: left sidebar on desktop, drawer on mobile, tables on desktop, cards on mobile. |
| NFR-09 | Timestamps shown in human format (e.g. "Today, 9:42 AM"). Stored in UTC. Displayed in the business time zone. *(See Q-6.)* |
| NFR-10 | Consistent status badges across all portals (one component, one colour per status). |
| NFR-11 | **[DECIDED]** Interface in English only. All UI text kept in one place so French can be added later. |

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
User (id, full_name, email, phone?, role, depot_id?, status, auth_provider[password|google], created_at)
Depot (id, name, location, address, phone?, status, created_at)
Product (id, name, code, description, image_url?, status)
ProductUnit (id, product_id, unit[Loaf|Pack|Caisse])
UnitConversion (id, product_id, from_unit, to_unit, factor)

Collection (id, number, distributor_id, created_at)
CollectionItem (id, collection_id, product_id, unit, quantity, base_quantity)

DepotDistribution (id, number, collection_id, depot_id, distributor_id, created_at)
DepotDistributionItem (id, distribution_id, product_id, unit, quantity, base_quantity)

DepotConfirmation (id, distribution_id, manager_id, comment?, confirmed_at)
DepotConfirmationItem (id, confirmation_id, distribution_item_id, confirmed_quantity)

Correction (id, target_table, target_id, field, original_value, corrected_value, admin_id, note?, created_at)
Notification (id, user_id, type, record_type, record_id, message, read_at?, created_at)
AuditLog (id, user_id, action, record_type, record_id, details_json, created_at)
```

Design notes:
- Remaining, Distributed, Difference, and both statuses are **computed**, not stored. They cannot drift out of sync.
- `DepotDistributionItem` now carries its own `unit`, because the hand-over unit can differ from the collected unit (DIS-05).
- `base_quantity` is the quantity converted to the product's smallest unit at the moment of submission. It freezes the conversion used, so later edits to a product's conversions do not change past balances. *(See Q-28.)*
- `Correction` is a separate table. Original rows are never updated in place.
- `DepotDistribution.distributor_id` duplicates the collection's distributor to make depot-manager queries and RLS simple. This is the only intended duplication.

## 10. Validation Summary

- Quantities: whole numbers only, no negatives, no text.
- Collection quantity > 0. Distribution quantity ≥ 0 (zero means "not included"). Count quantity ≥ 0.
- Distribution ≤ Remaining, per product, checked twice (UI and data layer).
- Confirmation allowed once per receipt.
- All submit buttons disable while processing.
- Final actions (submit collection, submit distribution, confirm receipt) go through a review screen.

## 11. Configurable Assumptions

The spec says: if a rule is missing, isolate it as config, do not hard-code policy. These live in one file (`src/config/business-rules.ts`) and, where useful, in Admin → Settings.

| Key | Default proposed | Why it is config |
|---|---|---|
| `businessTimeZone` | `Africa/Douala` | Defines "today". Not yet confirmed (Q-6). |
| `allowDecimalQuantities` | `false` | Spec does not say. |
| `collectionNumberFormat` | `COL-{seq:5}` global | Spec shows "#001" with no reset rule. |
| `distributionNumberFormat` | `RCP-{seq:5}` global | Same. |
| `staleCollectionHours` | `24` | When an In Progress collection is flagged to Admin. Spec does not say. |

---

## 12. Questions

### 12.1 Decided (round 1)

| # | Question | Owner answer |
|---|---|---|
| Q-1 | Can the hand-over (distribution) unit differ from the collected unit? | **Yes.** → DIS-05, DIS-06, DIS-07, data model. |
| Q-3 | One manager per depot, or several? | **One.** → DEP-03 |
| Q-5 | Can a distributor edit or cancel after submitting? | **No.** → COL-10, DIS-11 |
| Q-7 | How to show "Collected Today" with mixed units? | **Per unit.** → ADM-02 |
| Q-9 | "Your Count" empty or pre-filled? | **Empty.** → RCP-04 |
| Q-12 | Login method? | **Email + password, plus Google sign-in.** → AUTH-03, AUTH-04 |
| Q-19 | Language? | **English only for now.** → NFR-11 |
| Q-24 | Export format first? | **PDF first.** → RPT-04 |

### 12.2 New questions raised by round 1 answers

| # | Question | Proposed answer |
|---|---|---|
| Q-27 | Collected 10 Caisse (1 Caisse = 5 Packs). Handed over 7 Packs. Remaining is 43 Packs, which is 8 Caisse + 3 Packs. How should Remaining be shown? | "43 Packs (8 Caisse + 3 Packs)" — smallest unit, with the breakdown beside it. |
| Q-28 | Admin changes a conversion (1 Caisse = 5 Packs → 6 Packs). What happens to collections already recorded? | Past records keep the conversion that applied when they were submitted. Only new records use the new one. |
| Q-29 | Can a hand-over go from small to large units too? E.g. collected 500 Loaves, handed over 2 Caisse. | **Yes**, in any direction, as long as a conversion exists for that product. |
| Q-30 | With no conversion configured for a product, can the distributor still pick a different unit? | **No.** Only the collected unit is offered. (DIS-06) |
| Q-31 | Google sign-in for an email the Admin never registered. | **Refused.** Only Admin-created accounts can sign in, by password or Google. Matches "no public signup". |
| Q-32 | Real Google sign-in needs a live backend (Supabase Auth + a Google Cloud OAuth client). The spec says build on mock data first. | **Option A [PROPOSED]:** the Google button is built in Phase 1 but shows "Not available yet" until Phase 7 connects Supabase. **Option B:** connect Supabase Auth in Phase 1 so login (password and Google) is real from day one; business data stays mock until Phase 7. You will need to create the Google OAuth client either way. |
| Q-33 | Forgot password: email is now required for everyone. | `/forgot-password` sends a reset email once Supabase is connected. Before that it shows "Contact your administrator." Admin can always reset manually (USR-04). |

### 12.3 Still open from round 1

| # | Question | Proposed answer |
|---|---|---|
| Q-2 | Can a depot manager count in a different unit than the one on the receipt? | **No.** They count in the unit the distributor recorded on that receipt. |
| Q-4 | If a manager is replaced, does the new manager see the depot's past receipts? | **Yes.** Visibility follows the depot, not the person. |
| Q-6 | Which time zone defines "today"? | `Africa/Douala` (WAT, UTC+1). |
| Q-8 | A receipt sits unconfirmed for days. Does anything happen? | **Nothing automatic.** It stays Awaiting Confirmation and shows its age to Admin. |
| Q-10 | Can the manager report a product that arrived but was not on the receipt? | **No** in v1. They can mention it in the comment. |
| Q-11 | Can Admin correct collection and distribution quantities too, not only confirmations? Now more important, since distributors cannot edit. | **Yes**, with the same correction trail. A correction that would make Distributed > Collected is blocked. |
| Q-14 | Can there be more than one Admin? Who creates Admins? | **Multiple** allowed. Admins can create other Admins. First Admin seeded at setup. |
| Q-15 | Product deactivated while still on an In Progress collection: can it still be distributed? | **Yes.** Deactivation only blocks new collections. |
| Q-16 | Depot deactivated with Awaiting receipts: can its manager still confirm? | **Yes.** No new distributions to it. |
| Q-17 | Distributor deactivated with an In Progress collection. | Collection stays as-is, visible to Admin. Nobody else can distribute from it. |
| Q-18 | Leftover stock that will never be distributed. | No "abandon" option. The spec forbids unexplained balances. The collection stays In Progress and is flagged to Admin after `staleCollectionHours`. |
| Q-20 | Whole numbers only? | **Yes.** |
| Q-21 | Same product in two units on one collection (e.g. Big Bread 500 Loaves + 10 Caisse)? | **Allowed** as two lines. Same product + same unit twice is blocked. |
| Q-22 | Offline transactions in v1? | **No.** Online only. Offline screens show "No connection". |
| Q-23 | v1 runs on mock data, Supabase later? | **Yes** (but see Q-32 Option B for login). |
| Q-25 | Product images: where stored in v1? | URL field only. Upload added with Supabase Storage. |
| Q-26 | Should Admin get a notification for every new distribution, not only discrepancies? | **No.** Only NOT-04, per the spec. |

## 13. Delivery Plan

Each phase ends with a commit, a push to the working branch, and your sign-off before the next starts.

| Phase | Content | Done when |
|---|---|---|
| 0 | This document. | You approve it and answer Section 12. |
| 1 | Project scaffold, types, mock data layer, email/password login + route guards, Google button (per Q-32), three empty portal layouts with navigation. | You can log in as each role and cannot reach other portals. |
| 2 | Admin: Products (with conversions), Depots, Users. | Master data can be created and deactivated. |
| 3 | Distributor: Collections, Distributions, unit conversion on hand-over, balances, over-distribution block. | Section 3 example (800 → 250/300/250) works end to end, plus a mixed-unit case. |
| 4 | Depot Manager: pending receipts, count, review, lock. | Section 57 example workflow works end to end. |
| 5 | Admin: Dashboard, Today, Collection detail, Discrepancies, Corrections, Audit, Notifications. | Owner can answer the core question from the screen. |
| 6 | Reports, filters, **PDF export**, PWA manifest/service worker. | Filtered PDF matches screen. |
| 7 | Supabase backend + RLS + Google sign-in live + password reset email. CSV export. (Separate approval.) | Mock layer swapped, UI unchanged. |

## 14. Working Rules for the Build

- Nothing outside this document gets built.
- If a phase hits a gap not covered here, work stops on that point and the question comes to you.
- No repository-level destructive actions (force push, branch deletion, history rewrite).
- All work goes to branch `claude/practical-ritchie-mnkli1`.
