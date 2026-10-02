# Tally-Up — Requirements Document

**Status:** v0.4 — v0.3 approved; v0.4 records owner decisions Q-37 to Q-42 (early deploy, navigation, IDs, profile)
**Date:** 2026-10-02
**Source:** "TALLY-UP — Bakery Distribution Tracking System" specification (58 sections), plus owner answers recorded in Section 12

No code will be written until the owner approves this document.
Every rule below is either from the source spec or an owner decision in Section 12.

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

Truck management, truck capacity, truck registration, GPS, route optimisation, driver tracking, fuel, vehicle maintenance, warehouse manager role/portal, customer deliveries, customer accounts, retail sales, resellers, commissions, cash collection, invoices, payments, online ordering, production management, payroll, AI features, public signup, offline transactions (v1).

The app will not ask why a collection happened (hot bread, late batch, full truck). It records it.

## 3. Glossary

| Term | Meaning |
|---|---|
| Collection | One pickup event by one distributor. Many per day allowed. |
| Collection Item | One product + unit + quantity inside a collection. |
| Distribution (= hand-over) | One hand-over from one collection to one depot. Creates one Receipt. |
| Distribution Item | Product + unit + quantity given to that depot. The unit may differ from the collected unit. |
| Receipt | The depot-side view of a distribution. Same record, depot manager's perspective. |
| Confirmation | The depot manager's physical count, comment, and timestamp. Locked once submitted. |
| Base unit | **Loaf.** Every quantity in the system can be expressed in loaves. All balances and comparisons are done in loaves. |
| Loaves per unit | Admin-set number for each Pack/Caisse of each product (e.g. Big Bread: 1 Pack = 10 Loaves). |
| Remaining | Collected − Distributed, per product, in loaves. |
| Discrepancy | Any receipt line where the manager's count (in loaves) ≠ the distributor's recorded quantity (in loaves). |

## 4. Roles

Exactly three. No others.

| Role | Device focus | Scope of data |
|---|---|---|
| Admin / Owner | Desktop-first, responsive | Everything |
| Distributor | Mobile-first | Own collections, own distributions, their receipts' status |
| Depot Manager | Mobile-first | Only the assigned depot's receipts |

A distributor is not tied to any depot. Any active distributor may distribute to any active depot.
More than one Admin may exist. Admins can create other Admins. The first Admin is seeded at setup.

---

## 5. Functional Requirements

IDs are stable. Later commits and tests will reference them.

### 5.1 Authentication & Access

| ID | Requirement |
|---|---|
| AUTH-01 | Routes `/login` and `/forgot-password`. No signup route. |
| AUTH-02 | Accounts are created only by an Admin. |
| AUTH-03 | Login with **email + password**. |
| AUTH-04 | "Continue with Google" on the login screen. Google sign-in succeeds only if the Google email matches an active account an Admin already created. Otherwise: "No Tally-Up account exists for this email. Contact your administrator." |
| AUTH-05 | The owner creates the Google OAuth client manually and adds it in Supabase. Until that is done, the Google button shows "Not available yet". |
| AUTH-06 | `/forgot-password` sends a reset email (Supabase, from Milestone 2). Admin can always reset a password (USR-04). |
| AUTH-07 | After login, route by role: Admin → `/admin`, Distributor → `/distributor`, Depot Manager → `/depot`. |
| AUTH-08 | Route guards block a role from another portal's URLs, including typed URLs. Redirect to own portal. |
| AUTH-09 | Deactivated users cannot log in, by password or by Google. |
| AUTH-10 | Every data request is filtered by role and ownership in the data layer, not only in the UI, using Supabase Row Level Security policies from Milestone 2. |

### 5.2 Products (Admin)

| ID | Requirement |
|---|---|
| PRD-01 | Create, edit, activate/deactivate products. No hard delete. |
| PRD-02 | Fields: Name, Code (unique), Description, Image URL (optional), Supported Units, Loaves per Unit, Status. |
| PRD-03 | Supported units are chosen per product from: Loaf, Pack, Caisse. At least one required. |
| PRD-04 | **Loaf is the base unit.** For every Pack or Caisse a product supports, the Admin **must** enter how many loaves it holds. A product cannot be saved without it. |
| PRD-05 | The Admin may enter Caisse as "N Packs" or "N Loaves"; the system stores loaves (e.g. 1 Caisse = 5 Packs × 10 Loaves = 50 Loaves). Values are whole numbers. No conversion value is hard-coded anywhere. |
| PRD-06 | Changing a product's loaves-per-unit affects only new records. Past records keep the value used when they were submitted. |
| PRD-07 | Inactive products cannot be added to new collections. They can still be distributed from collections already In Progress. |

### 5.3 Depots (Admin)

| ID | Requirement |
|---|---|
| DEP-01 | Create, edit, activate/deactivate depots. No hard delete. |
| DEP-02 | Fields: Name, Location, Address/Description, Phone (optional), Assigned Manager, Status. |
| DEP-03 | One Depot Manager per depot. Assigning a new manager replaces the previous one. |
| DEP-04 | Receipt visibility follows the depot, not the person. A new manager sees the depot's full history. |
| DEP-05 | Depot detail page shows its distribution/receipt history. |
| DEP-06 | Inactive depots do not appear in the distributor's depot picker. Receipts already Awaiting Confirmation at an inactive depot can still be confirmed. |

### 5.4 Users (Admin)

| ID | Requirement |
|---|---|
| USR-01 | Admin creates, edits, activates/deactivates Admin, Distributor and Depot Manager accounts. |
| USR-02 | Fields: Full Name, Email (required — it is the login), Phone, Role, Assigned Depot (Depot Manager only), Status. |
| USR-03 | A Depot Manager account requires a depot. A Distributor account has no depot field. |
| USR-04 | Admin can reset a user's password. |
| USR-05 | A deactivated distributor's In Progress collections stay as they are, visible to Admin. Nobody else can distribute from them. |

### 5.5 Collections (Distributor)

| ID | Requirement |
|---|---|
| COL-01 | Flow: New Collection → Add Products → Review → Submit → "Collection Recorded" → Start Distribution. |
| COL-02 | Each row: Product, Unit (limited to that product's supported units), Quantity. |
| COL-03 | Multiple rows allowed. "Add Product" adds a row. |
| COL-04 | The same product may appear in two units (e.g. Big Bread 500 Loaves + 10 Caisse) as two rows. The same product + same unit twice is blocked. |
| COL-05 | Quantity: whole number, greater than zero. |
| COL-06 | Timestamp is set by the system on submit. Not user-editable. |
| COL-07 | A distributor may create any number of collections per day. Each is its own record with its own ID. |
| COL-08 | Status is computed, never set by hand: **In Progress** if any product has Remaining > 0 loaves; **Fully Distributed** when every product has Remaining = 0. |
| COL-09 | Submit button disables while processing. Double submission is prevented. |
| COL-10 | After submit, the distributor cannot edit or cancel the collection. |
| COL-11 | No "abandon" option. A collection left In Progress longer than `staleCollectionHours` is flagged to Admin. |

### 5.6 Distributions (Distributor)

| ID | Requirement |
|---|---|
| DIS-01 | Distributor picks one of their own In Progress collections and sees Remaining per product. |
| DIS-02 | Remaining is shown in loaves with a breakdown, e.g. "430 Loaves (8 Caisse + 3 Packs)". |
| DIS-03 | Distributor picks any active depot. |
| DIS-04 | For each product, the distributor chooses any unit that product supports and enters a "Give" quantity. The unit may differ from the collected unit, in either direction. Remaining updates live. |
| DIS-05 | Lines left empty or zero are excluded. At least one line must be > 0. |
| DIS-06 | **Over-distribution is blocked**, per product, by comparing in loaves. Message in the unit being entered, e.g. "Only 4 Packs (43 Loaves) are available for distribution." Validated on the client and again in the data layer. |
| DIS-07 | Review screen before submit. |
| DIS-08 | On submit: distribution is saved, its receipt status is **Awaiting Confirmation**, and the depot manager is notified. |
| DIS-09 | Success screen shows depot, products, receipt status, updated remaining quantities, and buttons "Distribute to Another Depot" and "Back to Dashboard". |
| DIS-10 | After submit, the distributor cannot edit or cancel the distribution. |
| DIS-11 | Distributor can list their past distributions with receipt status (Awaiting / Confirmed / Confirmed with Discrepancy). |
| DIS-12 | Distributor cannot confirm, edit, or see editing controls for any depot confirmation. |

### 5.7 Receipt Confirmation (Depot Manager)

| ID | Requirement |
|---|---|
| RCP-01 | Dashboard leads with Pending Receipts for the manager's depot only. |
| RCP-02 | Receipt screen header: Depot, Distributor, Date, Time, Receipt ID. |
| RCP-03 | "Distributor Recorded" section: Product, Unit, Quantity (read-only). |
| RCP-04 | "Your Count" fields start **empty**. The manager must type each count. |
| RCP-05 | The manager may count in any unit the product supports, not only the recorded unit. |
| RCP-06 | One product line may hold several count entries in different units (e.g. 19 Packs + 5 Loaves). The system totals them in loaves. |
| RCP-07 | Count accepts zero and any whole number ≥ 0. Count may exceed the recorded quantity. |
| RCP-08 | Products that arrived but are not on the receipt cannot be added. The manager can mention them in the comment. |
| RCP-09 | "Comment (Optional)" field always visible. Never required, with or without a discrepancy. |
| RCP-10 | Review screen shows per line: Recorded, Counted, Difference (in loaves), and ✓ Match or ⚠ Difference. Shows comment. Shows text: "Once confirmed, this receipt cannot be edited." |
| RCP-11 | System computes status. **Confirmed** if every line matches in loaves. **Confirmed with Discrepancy** if any line differs. The manager never picks a status. No "Dispute" button exists. |
| RCP-12 | After submit, counts, comment, and status are locked for the manager. |
| RCP-13 | Distributor and Admin are notified of the result. |
| RCP-14 | Manager can view their depot's receipt history. |
| RCP-15 | A receipt left unconfirmed has no automatic action. It stays Awaiting Confirmation and its age is shown to Admin. |

### 5.8 Reconciliation Rules

| ID | Rule |
|---|---|
| REC-01 | Per collection, per product: `Collected = Distributed + Remaining`, in loaves. |
| REC-02 | Per receipt line: `Difference = Confirmed − Recorded`, in loaves. The original units entered by each person are also shown. |
| REC-03 | Recorded and Confirmed are stored in separate tables. One never overwrites the other. |
| REC-04 | Reconciliation is per product. Totals across products are never used as a substitute. |
| REC-05 | Collection status (distribution completeness) and receipt status (depot verification) are independent. A collection can be Fully Distributed while one of its receipts is Confirmed with Discrepancy. |

### 5.9 Admin Corrections

| ID | Requirement |
|---|---|
| COR-01 | Admin may correct collection quantities, distribution quantities, confirmation counts, and confirmation comments. |
| COR-02 | A correction never overwrites. It stores: original value, corrected value, admin, timestamp, optional note. |
| COR-03 | A correction that would make Distributed > Collected for any product is blocked. |
| COR-04 | UI shows corrected values with a visible "Corrected" marker and the history behind it. |
| COR-05 | Statuses recompute from corrected values. The original status remains visible in the correction history. |

### 5.10 Admin Monitoring

| ID | Requirement |
|---|---|
| ADM-01 | Dashboard KPI cards: Collected Today, Distributed Today, Remaining to Distribute, Awaiting Confirmation (count), Confirmed Receipts (count), Discrepancies (count). |
| ADM-02 | Quantity KPIs show **per unit** as entered (e.g. "4,200 Loaves · 310 Packs · 45 Caisse"). No combined grand total. |
| ADM-03 | Today's Activity: list of today's collections with ID, distributor, time, collected, distributed, remaining, status. Each opens a detail page. |
| ADM-04 | Collection detail: ID, distributor, date, time, lines (product/unit/qty), distributed, remaining, status; then Depot Allocations grouped by depot with receipt status. Each receipt opens. |
| ADM-05 | Discrepancies page: date, distributor, depot, product, recorded qty + unit, confirmed qty + unit(s), difference in loaves, comment, confirmation time. Discrepancies are never hidden or auto-cleared. |
| ADM-06 | Stale collections (COL-11) and aged receipts (RCP-15) are visible to Admin. |
| ADM-07 | Admin does not need to take part in normal transactions. |

### 5.11 Reports & Export

| ID | Requirement |
|---|---|
| RPT-01 | Filters: single date, date range, depot, product, distributor, receipt status, discrepancy yes/no. |
| RPT-02 | Reports answer: collected per day, distributed per day, received per depot, distributor per distribution, products per depot, receipts with discrepancies, recorded vs confirmed totals. |
| RPT-03 | Export uses exactly the filtered dataset on screen. |
| RPT-04 | **PDF export in v1.** CSV/Excel added later through the same export interface. |

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
| NOT-05 | — | — | Read/unread state. Admin is not notified of every distribution, only discrepancies. Sending goes through one service so push can be added later without changing callers. |

---

## 6. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | Stack: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, Lucide, TanStack Query. |
| NFR-02 | Hosting: **Vercel**. Database and auth: **Supabase, added through the Vercel Marketplace integration** (Postgres, Auth with Google provider, Row Level Security, Storage). |
| NFR-03 | All data access goes through service interfaces. From Milestone 2 the deployed app uses Supabase, so testers on different phones share one database. A mock implementation of the same interfaces is used only for automated tests and offline local development. |
| NFR-03a | The app is deployed to Vercel and installable as a PWA from Milestone 1, so it can be tested on real phones as each milestone lands. Every push to the working branch gets a Vercel preview URL. |
| NFR-04 | Folder separation: `pages`, `components`, `layouts`, `services`, `hooks`, `types`, `auth`, `config`, `lib`. No single-file app. |
| NFR-05 | PWA: installable manifest and service worker for the app shell. |
| NFR-06 | Online only in v1. With no connection, screens show "No connection" and block submits. No fake sync: a write is never shown as saved until the data layer confirms it. |
| NFR-07 | Every data screen has loading (skeleton), empty, error, and success states. |
| NFR-08 | Mobile portals: bottom nav, large tap targets (≥ 44px), numeric keypad on quantity inputs, sticky primary action, cards not tables. |
| NFR-09 | Admin portal: left sidebar on desktop, drawer on mobile, tables on desktop, cards on mobile. |
| NFR-10 | Timestamps stored in UTC, displayed in **Africa/Douala** (WAT, UTC+1) in human format (e.g. "Today, 9:42 AM"). "Today" means today in Douala. |
| NFR-11 | Consistent status badges across all portals (one component, one colour per status). |
| NFR-12 | Interface in English only. All UI text kept in one place so French can be added later. |
| NFR-13 | Secrets (Supabase keys, Google OAuth client) come from environment variables. None are committed to the repository. |

## 7. Navigation

| Portal | Desktop | Phone (PWA) |
|---|---|---|
| Admin | Left sidebar, **at most 7 items** | **4 bottom tabs** |
| Distributor | — (mobile-first) | 5 bottom tabs: Dashboard · Collections · Distributions · History · Profile |
| Depot Manager | — (mobile-first) | 4 bottom tabs: Dashboard · Receipts · History · Profile |

**Admin navigation contents are not decided yet (NAV-1).** The admin pages that must be reachable are: Dashboard, Collections, Distributions, Discrepancies, Depots, Products, Users, Reports, Notifications, Audit, Settings. The owner will decide which go in the 7 sidebar items and the 4 phone tabs, and how the rest are reached. Until then, nothing is built for admin navigation beyond the layout shell.

**Profile (all roles):** name, email, role, assigned depot (managers), change password, sign out. No App Settings, Help & Support, or About.

Settings (Admin) holds only items from Section 11. Nothing else is invented for it.

## 8. Status Values

| Entity | Values | Set by |
|---|---|---|
| Collection | In Progress, Fully Distributed | Computed |
| Receipt | Awaiting Confirmation, Confirmed, Confirmed with Discrepancy | Computed |
| User / Depot / Product | Active, Inactive | Admin |

## 9. Data Model

```
User (id, full_name, email, phone?, role[admin|distributor|depot_manager], depot_id?, status, created_at)
Depot (id, name, location, address, phone?, status, created_at)
Product (id, name, code, description, image_url?, status)
ProductUnit (id, product_id, unit[Loaf|Pack|Caisse], loaves_per_unit)   -- Loaf row always = 1

Collection (id, number, distributor_id, created_at)
CollectionItem (id, collection_id, product_id, unit, quantity, loaves_per_unit_snapshot)

DepotDistribution (id, number, collection_id, depot_id, distributor_id, created_at)
DepotDistributionItem (id, distribution_id, product_id, unit, quantity, loaves_per_unit_snapshot)

DepotConfirmation (id, distribution_id, manager_id, comment?, confirmed_at)
DepotConfirmationCount (id, confirmation_id, distribution_item_id, unit, quantity, loaves_per_unit_snapshot)

Correction (id, target_table, target_id, field, original_value, corrected_value, admin_id, note?, created_at)
Notification (id, user_id, type, record_type, record_id, message, read_at?, created_at)
AuditLog (id, user_id, action, record_type, record_id, details_json, created_at)
```

Design notes:
- Loaves are computed as `quantity × loaves_per_unit_snapshot`. The snapshot freezes the conversion at submit time (PRD-06).
- Remaining, Distributed, Difference, and both statuses are **computed**, not stored. They cannot drift out of sync.
- `DepotConfirmationCount` replaces the spec's `DepotConfirmationItem`. One distribution line can have several count rows in different units (RCP-06).
- The spec's separate `UnitConversion` entity is folded into `ProductUnit.loaves_per_unit`, because every unit converts to loaves (PRD-04).
- `Correction` is a separate table. Original rows are never updated in place.
- `DepotDistribution.distributor_id` duplicates the collection's distributor to keep depot-manager queries and RLS simple. This is the only intended duplication.

## 10. Validation Summary

- Quantities: whole numbers only, no negatives, no text.
- Collection quantity > 0. Distribution quantity ≥ 0 (zero means "not included"). Count quantity ≥ 0.
- Distribution ≤ Remaining, per product in loaves, checked twice (UI and data layer).
- Product with Pack/Caisse cannot be saved without loaves-per-unit.
- Confirmation allowed once per receipt.
- All submit buttons disable while processing.
- Final actions (submit collection, submit distribution, confirm receipt) go through a review screen.

## 11. Configurable Assumptions

Kept in one file (`src/config/business-rules.ts`), and shown in Admin → Settings where useful.

| Key | Value | Note |
|---|---|---|
| `businessTimeZone` | `Africa/Douala` | Owner confirmed. |
| `baseUnit` | `Loaf` | Owner confirmed. |
| `allowDecimalQuantities` | `false` | Owner accepted. |
| `collectionNumberFormat` | `COL-{seq:5}` global | Spec shows "#001" with no reset rule. |
| `distributionNumberFormat` | `DIS-{seq:5}` global (e.g. DIS-00018) | Owner chose DIS- (Q-39). One number per hand-over, shown the same to distributor, manager and admin. |
| `staleCollectionHours` | `24` | When an In Progress collection is flagged to Admin. |

---

## 12. Decision Log

| # | Question | Decision |
|---|---|---|
| Q-1 | Hand-over unit different from collected unit? | **Yes.** (DIS-04) |
| Q-2 | Manager counts in a different unit? | **Yes**, any unit convertible to loaves. (RCP-05) |
| Q-3 | Managers per depot | **One.** (DEP-03) |
| Q-4 | New manager sees past receipts? | **Yes.** (DEP-04) |
| Q-5 | Distributor edits/cancels after submit? | **No.** (COL-10, DIS-10) |
| Q-6 | Time zone | **Africa/Douala.** (NFR-10) |
| Q-7 | KPI with mixed units | **Per unit.** (ADM-02) |
| Q-8 | Old unconfirmed receipts | Nothing automatic; age shown. (RCP-15) |
| Q-9 | Count fields empty or pre-filled? | **Empty.** (RCP-04) |
| Q-10 | Manager adds unlisted product? | **No**; use comment. (RCP-08) |
| Q-11 | Admin corrects collection/distribution too? | **Yes**, with trail; can't exceed collected. (COR-01, COR-03) |
| Q-12 | Login | **Email + password, plus Google.** (AUTH-03, AUTH-04) |
| Q-13 | Forgot password | Reset email after backend; admin reset always. (AUTH-06) |
| Q-14 | Multiple Admins? | **Yes.** (Section 4) |
| Q-15 | Deactivated product on open collection | Still distributable. (PRD-07) |
| Q-16 | Deactivated depot with pending receipts | Still confirmable. (DEP-06) |
| Q-17 | Deactivated distributor's open collection | Stays; Admin sees it. (USR-05) |
| Q-18 | Abandon leftover stock? | **No**; flagged after 24h. (COL-11) |
| Q-19 | Language | **English only for now.** (NFR-12) |
| Q-20 | Whole numbers only? | **Yes.** |
| Q-21 | Same product in two units on one collection | **Allowed**; same unit twice blocked. (COL-04) |
| Q-22 | Offline in v1? | **No.** (NFR-06) |
| Q-23 | Mock data first? | ~~Yes, Supabase in Milestone 7~~ — **replaced by Q-37**: Supabase from Milestone 2. |
| Q-24 | Export format | **PDF first.** (RPT-04) |
| Q-25 | Product images | URL field; upload with Supabase Storage. |
| Q-26 | Admin notified of every distribution? | **No**, only discrepancies. (NOT-05) |
| Q-27 | How to show Remaining | Loaves with breakdown. (DIS-02) |
| Q-28 | Conversion changed later | Past records keep old value. (PRD-06) |
| Q-29 | Hand-over small → large unit? | **Yes**, either direction. (DIS-04) |
| Q-30 | Unit with no conversion | Superseded: loaves-per-unit is now required. (PRD-04) |
| Q-31 | Google login for unregistered email | **Refused.** (AUTH-04) |
| Q-32 | Google before backend | ~~Not available until Milestone 7~~ — **replaced by Q-37**: works once the owner adds the OAuth client. (AUTH-05) |
| Q-33 | Reset email | After backend connected. (AUTH-06) |
| Q-34 | Which database | **Supabase via Vercel Marketplace.** (NFR-02) |
| Q-35 | Loaves-per-unit required? | **Yes.** (PRD-04) |
| Q-36 | Manager mixes units on one line? | **Yes**, e.g. 19 Packs + 5 Loaves. (RCP-06) |
| Q-37 | Deploy and test early? | **Yes.** Vercel + PWA from Milestone 1; Supabase from Milestone 2 so all testers share data. Replaces Q-23 and Q-32. (NFR-03, NFR-03a) |
| Q-38 | Wireframes vs requirements | **Requirements win** where they conflict. |
| Q-39 | Hand-over number prefix | **DIS-** (Section 11) |
| Q-40 | Admin navigation | Desktop sidebar max 7 items; phone 4 bottom tabs. Contents decided later (NAV-1). (Section 7) |
| Q-41 | Profile extras | **Remove** App Settings, Help & Support, About. (Section 7) |
| Q-42 | Screens with no wireframe | Designed together when their milestone comes. |
| Q-43 | Who creates the Vercel project | **The owner**, in the Vercel dashboard, linked to `Ndukwopeace/Tally-up`. The owner also adds the Supabase integration (staging + production) before Milestone 2. |
| Q-44 | "Phase" or "Milestone" | **Milestone.** All documents, CI comments and branch names use "milestone" (e.g. `feat/milestone-1-scaffold`). |

### Open items

| # | Item | When |
|---|---|---|
| NAV-1 | Which admin pages go in the 7 sidebar items and 4 phone tabs, and how the others are reached | Before Milestone 3 (first admin screens) |

## 13. Delivery Plan

Each milestone ends with a pull request into `main`, a Vercel preview to test on, and owner sign-off before the next one starts. Version tag `v0.<milestone>.0` is set when the milestone merges (ENG-8).

| Milestone | Content | Done when |
|---|---|---|
| 0 | Requirements, architecture, UI rules. | Owner approves them. |
| 1 | Project scaffold, design tokens, shared components, business-rules config, **PWA (manifest, service worker, install prompt)**, three portal layout shells, **deployed to Vercel**. | Owner opens the Vercel link on a phone and installs the app to the home screen. |
| 2 | **Supabase via Vercel**: schema, RLS, database functions, seed data, admin user API. Email/password login, forgot password, route guards. Google sign-in once the owner adds the OAuth client. | Owner logs in as each role on a real phone and cannot reach other portals. |
| 3 | Admin: Products (with loaves-per-unit), Depots, Users. Admin navigation per NAV-1. | Master data can be created and deactivated. |
| 4 | Distributor: Collections, Distributions, mixed units, balances in loaves, over-distribution block. | Spec Section 3 example (800 → 250/300/250) works, plus a Caisse-collected / Pack-distributed case. |
| 5 | Depot Manager: pending receipts, mixed-unit count, review, lock. | Spec Section 57 workflow works end to end **across two phones**. |
| 6 | Admin: Dashboard, Today, Collection detail, Discrepancies, Corrections, Audit, Notifications. | Owner can answer the core question from the screen. |
| 7 | Reports, filters, PDF export, image upload, CSV export, real-user test, production go-live. | Filtered PDF matches screen; real users complete Section 57 on their own phones. |

## 14. Working Rules for the Build

- Nothing outside this document gets built.
- If a milestone hits a gap not covered here, work stops on that point and the question comes to the owner.
- No repository-level destructive actions (force push, branch deletion, history rewrite).
- All work goes to branch `claude/practical-ritchie-mnkli1`.
