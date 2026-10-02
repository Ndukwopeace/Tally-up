# Tally-Up

Internal bakery distribution tracking. Distributors record what they **collect**, what they **hand over to each depot**, and depot managers record what they **physically counted**. The system compares the records and shows the owner every discrepancy.

Not a sales, delivery, truck or warehouse system. Full scope: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md).

## Status

| Milestone | Content | State |
|---|---|---|
| 0 | Documents | Done |
| 1 | Foundation: scaffold, design tokens, shared components, PWA, portal frames, Vercel | Done |
| A1 | Admin login (Supabase, security rules, sign-in, forgot password, sign out) | Done (v0.2.0) |
| A2 | Admin data: products, depots, users | In progress: A2a and A2b merged; A2c Users in review |
| A3 | Admin monitoring | Planned |
| A4 | Admin reports | Planned |
| D… / DM… | Distributor, then Depot Manager | Planned later |
| Go-live | All roles, real-user test, v1.0.0 | Planned |

Plan: [`docs/REQUIREMENTS.md` §13](docs/REQUIREMENTS.md).

## Run it locally

Requires Node 22.22 or newer (CI uses Node 24).

```bash
npm install        # installs exact versions from package-lock.json; also sets up the pre-commit hook
npm run dev        # http://localhost:5173
```

**Database settings.** Without Supabase settings the app shows "Tally-Up is not connected". Either copy `.env.example` to `.env.local` and fill in the **staging** URL and public key, or work offline with the mock:

```bash
VITE_DATA_SOURCE=mock VITE_MOCK_PASSWORD=<any password you choose> npm run dev
```

The mock (development only, never deployed) has these fictional accounts, all with the password you set in `VITE_MOCK_PASSWORD` (no password is stored in the code):

| Email | Account |
|---|---|
| `admin@tallyup.test` | Active admin |
| `old.admin@tallyup.test` | Inactive admin (refused) |
| `distributor@tallyup.test` | Distributor (refused until D1) |
| `manager@tallyup.test` | Depot manager (refused until DM1) |
| `orphan@tallyup.test` | Login with no Tally-Up account (refused) |

| Command | What it does |
|---|---|
| `npm run dev` | Development server with live reload |
| `npm run build` | Production build into `dist/` (includes the service worker) |
| `npm run preview` | Serves `dist/` locally, to test the PWA |
| `npm test` | Unit and component tests |
| `npm run test:coverage` | Tests + coverage floors (ENG-5) |
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint (zero warnings allowed in CI) |
| `npm run format` | Formats code with Prettier |
| `npm run budget` | Fails if initial JavaScript > 250 KB gzipped (PERF-1) |
| `npm run db:test` | Database security tests (pgTAP) on a throwaway local Postgres 16 |

## Deploy

Vercel builds every push. Each branch gets a preview URL; `main` is production. Settings are in [`vercel.json`](vercel.json) (routing and security headers). Supabase settings come from the Vercel integration's environment variables, never from the repository. Owner steps for Supabase (migrations, first admin, redirect URLs): [`docs/SETUP.md`](docs/SETUP.md).

## Project layout

```
src/
  app/         routes, navigation config, providers, root layout
  auth/        sign-in state, access rules, route guards
  config/      business-rules.ts (owner decisions, REQUIREMENTS §11), env.ts (backend settings)
  domain/      pure business logic (100 % test coverage)
  components/  ui/ (base controls) and common/ (shared app components)
  layouts/     portal frames: Admin, Distributor, Depot Manager
  pages/       screens
  pwa/         install and update prompts
  services/    backend interfaces; Supabase and mock (tests/local only) implementations
  types/       shared record and enum types
  hooks/       shared React hooks
  i18n/        all user-facing text (en.ts)
  lib/         small helpers
  styles/      design tokens (index.css)
public/        icons and favicon
scripts/       build helpers (budget check, icon generator, database test runner)
supabase/      migrations (SQL) and database tests (pgTAP)
tooling/       build-time helpers used by vite.config.ts
tests/         test setup, mocks and helpers
docs/          requirements, architecture, UI rules, engineering, ADRs, traceability
```

## Rules

Read [`CLAUDE.md`](CLAUDE.md) and [`docs/README.md`](docs/README.md) before contributing. Changes go through pull requests into `main`; CI must be green.
