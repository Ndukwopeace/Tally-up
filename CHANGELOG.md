# Changelog

All notable changes to Tally-Up. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions: [Semantic Versioning](https://semver.org/), `0.<milestone>.<patch>` until go-live (ENG-8).

## [Unreleased]

### Added — A3b Collections and Distributions
- Admin → Collections and Distributions: lists newest first with filters (date, distributor or depot, status; "with discrepancy only"), kept in the page address, 25 at a time with "Load more" (Q-59g).
- Collection page: lines, balance per product in loaves with the breakdown ("60 Loaves (1 Caisse + 1 Pack)"), and the depot allocations grouped by depot, each with its receipt status.
- Receipt page: what the distributor recorded against what the depot counted, line by line, the difference in loaves, mixed units, and the comment.
- Flags after 24 hours for a collection still In Progress and a receipt still Awaiting Confirmation, and the age of a waiting receipt (COL-11, RCP-15, Q-59f). Corrected values are marked with what they were (COR-04).
- Database: list views `v_collection_list` and `v_receipt_list` (16 new pgTAP checks). Dates are Douala days, shown as "Today, 9:42 AM".

### Added — A3a Operational data
- Tables for collections, hand-overs (distributions), depot confirmations and counts, corrections and notifications, with Row Level Security per role and no write path through the API (AUD-01, COR-02). Record numbers COL-00001 and DIS-00001.
- Views that apply corrections and compute Remaining, receipt differences and both statuses in loaves (REC-01, REC-02, COL-08, RCP-11, COR-05).
- TypeScript rules for loaf conversion, breakdown, balances and statuses, tested with the same numbers as the database.
- Staging-only test data in `supabase/seed/` with a reset (Q-59b), and a test that runs it.
- New setting `agedReceiptHours` = 24 (Q-59f). Owner answers recorded as Q-59.

## [0.3.0] — A2 Admin data

Products (A2a), Depots (A2b) and Users (A2c). Signed off by the owner on 2026-10-04.

### Changed — A2c Users
- An inactive depot is no longer offered to a depot manager in the Users form, and the database refuses it (Q-58a).
- An inactive depot has no manager (Q-58c): saving a depot as inactive deactivates its manager, the Depot form hides the manager list for an inactive depot and warns first, and a manager cannot be chosen for one.
- Decision recorded: discrepancies are shown on Home and inside Distributions, with no page of their own (Q-58b, closes NAV-1).

### Added — A2c Users
- Admin → More → Users: list with search by name or email; add and edit forms; reset password.
- Create an account (name, email, phones, role, depot for a manager, Active) with a temporary password the admin types and passes on (Q-57a). Edit email and role later (Q-57g). Deactivate, never delete.
- Reset a password by setting a new temporary password (Q-57b).
- A depot manager needs a depot while active; choosing a depot that has a manager deactivates that manager, and the form says so before saving (Q-57c).
- An admin cannot deactivate themselves, and the only active admin cannot change role (Q-57f, USR-06).
- Vercel Functions `/api/admin/users` (create), `/api/admin/users/:id` (edit) and `/api/admin/users/:id/reset-password`. They verify the caller is an active admin before acting. The secret server key exists only there.
- Database: `profiles.phones`, `admin_save_user()`, `admin_record_password_reset()` (server key only), audit entries for each change; 49 new pgTAP checks.

### Added — A2b Depots
- Admin → More → Depots: list with search, manager and Active/Inactive; depot page with tap-to-call phones and a history section; add and edit forms.
- Phone numbers: optional, several per depot, Cameroon format, stored as +237… (Q-57i). Address required (Q-57k).
- One manager per depot. Choosing a new one deactivates the old one, and the form says so before saving (Q-57c).
- Database: `depots`, `profiles.depot_id`, `admin_save_depot()` (the only write path, audited), RLS by role; 29 new pgTAP checks.

### Added — A2a Products
- Admin → More → Products: list with search, units in loaves and Active/Inactive; add and edit forms.
- Loaf is always a unit; Pack and Caisse optional with loaves per unit; a Caisse can be entered as loaves or as packs and is stored in loaves (PRD-05, Q-57d).
- Database: `products`, `product_units`, `admin_save_product()` (the only write path, audited), RLS by role; 30 new pgTAP checks.
- Decisions Q-57 (A2 rules) recorded in REQUIREMENTS; product photos dropped (Q-57e); description optional (Q-57j).

## [0.2.0] — A1 Admin login

### Added
- Supabase connected: `profiles` and `audit_log` tables with Row Level Security, role helpers, and `record_login()` (migration `20261002120000_a1_profiles_and_audit.sql`), with 35 pgTAP database tests and a `db-test` CI job.
- Login page (email + password; Google shown as "Not available yet"), forgot password, reset password from the email link.
- Route guards on all portals: signed-out visitors go to `/login`; each role is kept in its own portal; `/` sends you to your portal.
- Only admins can sign in for now (Q-55); other roles and inactive accounts are refused with a plain reason.
- Profile / My Account: name, email, role, change password, Sign Out.
- Sign Out acts at once from the account menu and Profile, showing "Signing out…" (Q-56).
- Feedback on every action (Q-56): loading bar while a screen loads, buttons and tabs press down when tapped.
- Owner setup guide `docs/SETUP.md`; ADR 0002; `.env.example`.

### Changed
- The temporary "Choose a portal" start page is gone; the login page replaces it (install card included).
- Back (Q-56, replaces Q-53): now a "Back" link under the header, only on pages inside a tab or opened from the header; it never changes tabs or signs out. Home, tab screens, login pages and Page not found have none.
- Content-Security-Policy allows data connections to Supabase only.
- Milestones re-cut per role (Q-55): A1–A4 for Admin, then Distributor, Depot Manager, go-live.

## [0.1.0] — Milestone 1

### Added
- Project scaffold: React 19, TypeScript 6 (strict), Vite 8, Tailwind CSS 4, React Router 8, TanStack Query 5, Lucide icons.
- Design tokens (colours with checked contrast, type scale, radii, focus ring) in `src/styles/index.css`.
- Business-rules config matching REQUIREMENTS §11 (`src/config/business-rules.ts`).
- Quantity parser: whole numbers only, accepts `1,500` / `1 500`, refuses decimal commas (Q-20, P-1).
- Shared components: Button, SubmitButton, QuantityInput, StatusBadge, EmptyState, ErrorState, PageSkeleton, ConnectionBanner, AppLogo.
- Portal frames: Admin (sidebar, NAV-1 pending), Distributor (5 tabs), Depot Manager (4 tabs); placeholder screens naming their milestone; Not Found page.
- PWA: manifest, icons, service worker (app shell only), install prompt, "new version" prompt.
- Vercel config: SPA routing, strict Content-Security-Policy and security headers.
- Tooling: ESLint (type-aware + jsx-a11y strict), Prettier, Husky + lint-staged pre-commit, Vitest with coverage floors, JS budget check.
- Docs: README, ADR 0001, traceability map, PR template.

### Changed
- Admin is phone-first (Q-48) with bottom tabs Home · Collections · Distributions · More, a More page (Depots, Products, Users, Reports), and an account menu (Profile / My Account, Sign Out) next to the bell (Q-47).
- Back arrow on every screen (Q-53): tab screens go back to their portal home, home goes back to the start page, Page not found has Back too.
- Start page layout A (Q-54): logo at the top, heading and portal choices at the bottom, within thumb reach.
- More page also holds Audit log and Settings (Q-51). Milestone plan re-cut role by role (Q-52).
- Distributor tabs: Dashboard · Collections · Distributions · Profile; History tab removed (Q-46).
- Navigation (Q-50): Back arrow on every sub-page; logo returns home; tabs no longer add browser history; sideways swipe-navigation turned off where the browser allows.
- UI review fixes: status-bar safe area, active tab marked with a pill (not colour alone), white status-bar colour, plain "Coming soon" wording, stronger card borders, larger logo, aligned header width, today's date on home tabs, clearer start page, branded Not Found page, iPhone install instructions.
- Logo replaced with the wireframe truck logo (Q-45): header, sidebar, favicon and all app icons now share one shape file (`src/assets/logo-shapes.json`).
- CI: removed the temporary `project` guard job; all checks now always run.
