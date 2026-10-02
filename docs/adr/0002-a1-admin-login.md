# ADR 0002 — A1 Admin login: technical choices

**Status:** Proposed (part of the A1 pull request; accepted when the owner merges it)
**Date:** 2026-10-02

## Context

A1 connects Supabase and adds sign-in for admins (Q-55). The requirements and architecture fix the behaviour; this record lists the technical choices the build needed that the documents do not spell out. None change business behaviour. Items that touch the architecture are listed there as proposed amendments A-5 to A-10.

## Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | **Packages: `@supabase/supabase-js` 2.117.2 and `zod` 4.6.5** (owner-approved). Zod is imported as `zod/mini`. | `zod/mini` is the same package with a smaller API; it saves 17 KB gzipped. Initial JS is now 183 KB of the 250 KB budget. |
| 2 | **react-hook-form not installed** (approved in T-1). Forms use plain React state. | Three small forms (2 fields each) do not need it. Revisit in A2 when the product and user forms arrive. |
| 3 | **Env names mapped at build time** (`tooling/supabase-public-env.ts`, A-5). | The Vercel integration creates names like `SUPABASE_URL`; Vite only exposes `VITE_*`. Mapping in the build avoids copying keys by hand. The build stops if the key is a secret key (`sb_secret_…` or a JWT for any role other than `anon`). |
| 4 | **Mock backend only in development builds.** Guarded by `import.meta.env.DEV`; checked that the mock's accounts are absent from `dist/`. The mock's password is never written in code: tests use a random one per run, local development reads `VITE_MOCK_PASSWORD` (SonarCloud hard-coded credential finding). | NFR-03 / A-2. A stray `VITE_DATA_SOURCE=mock` on Vercel cannot switch real users to fake logins. |
| 5 | **Implicit auth flow** (A-6). | The PKCE flow only works if the reset link opens in the same browser that asked for it. On iPhone the email usually opens Safari, not the installed app. |
| 6 | **`record_login()` database function for AUD-03** (A-7). The app calls it after a successful sign-in; if it fails, the user is signed out. | Supabase has no supported "after login" database hook. The function takes no user id, so a caller can only log their own login, and it re-checks the account is active. Limitation: a person calling the Supabase API directly (not through the app) could skip it. Their login still works in Supabase, but they cannot read any data RLS does not allow. |
| 7 | **A refused account's session is ended at once** (inactive, no profile, portal not open). | No valid token is left on the phone for an account that may not use the app. |
| 8 | **Sign-out ends this device's session only** (scope `local`). | Signing out on a phone should not sign the admin out of other devices. |
| 9 | **Sign Out without confirmation; Back only inside a tab** (A-8, Q-56). | A first build used a "Sign out?" page reached from Back on Home. After testing it, the owner decided (Q-56) that Sign Out acts at once with a progress indicator and that Back never signs out, never changes tabs and is not placed beside the logo. |
| 10 | **Distributor and depot portals stay built and guarded** but refuse sign-in (`OPEN_PORTALS = ["admin"]`). | Q-55: those accounts cannot sign in until D1 / DM1. Opening a portal later is a one-line change plus its milestone's work. |
| 11 | **Password strength left to Supabase.** The app only checks that a new password is entered twice the same. | Requirements set no password rule; inventing one would be assuming a business rule. The owner sets the minimum length in Supabase (docs/SETUP.md). |
| 12 | **pgTAP database tests on plain Postgres 16** with a stand-in `auth` schema (A-10); CI job `db-test` installs Postgres, pgTAP and pg_prove from Ubuntu's package archive. | Tests never touch the real Supabase projects. The stand-in reproduces Supabase's default grants, so the tests prove the migration removes them itself. |
| 13 | **Migration applied by the owner in the SQL editor** (docs/SETUP.md). | This build environment cannot reach supabase.com, and adding the Supabase CLI to CI would need a database password stored as a GitHub secret. Revisit if migrations become frequent. |
| 14 | **`e2e` CI job not added yet.** | It needs Playwright and axe packages (owner approval) and access to Vercel previews, which are protected. Covered meanwhile by component tests and a manual phone check. |
| 15 | **Guard prop named `allow`**, not `role`. | The accessibility linter treats a `role` prop as an ARIA role and fails the build. |

## Consequences

- The owner must run the migration and create the first admin in each Supabase project before signing in (docs/SETUP.md).
- Forgot-password emails reach only the owner's Supabase team until an email provider is set up (open item SMTP-1).
- A2 must ban a deactivated user in Supabase Auth (service-role API), so they cannot sign in at all; A1 already refuses them in the app and in the database.
