# Tally-Up

Internal bakery distribution tracking. Distributors record what they **collect**, what they **hand over to each depot**, and depot managers record what they **physically counted**. The system compares the records and shows the owner every discrepancy.

Not a sales, delivery, truck or warehouse system. Full scope: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md).

## Status

| Milestone | Content | State |
|---|---|---|
| 0 | Documents | Done |
| 1 | Foundation: scaffold, design tokens, shared components, PWA, portal frames, Vercel | Done |
| 2 | Login and roles (Supabase) | Next |
| 3–5 | Admin: data, monitoring, reports | Planned |
| 6 | Distributor | Planned |
| 7 | Depot Manager | Planned |
| 8 | All roles together, real-user test, go-live | Planned |

Plan: [`docs/REQUIREMENTS.md` §13](docs/REQUIREMENTS.md).

## Run it locally

Requires Node 22.22 or newer (CI uses Node 24).

```bash
npm install        # installs exact versions from package-lock.json; also sets up the pre-commit hook
npm run dev        # http://localhost:5173
```

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

## Deploy

Vercel builds every push. Each branch gets a preview URL; `main` is production. Settings are in [`vercel.json`](vercel.json) (routing and security headers). Environment variables arrive in Milestone 2 and are set in the Vercel dashboard, never committed.

## Project layout

```
src/
  app/         routes, navigation config, providers, root layout
  config/      business-rules.ts (owner decisions, REQUIREMENTS §11)
  domain/      pure business logic (100 % test coverage)
  components/  ui/ (base controls) and common/ (shared app components)
  layouts/     portal frames: Admin, Distributor, Depot Manager
  pages/       screens
  pwa/         install and update prompts
  hooks/       shared React hooks
  i18n/        all user-facing text (en.ts)
  lib/         small helpers
  styles/      design tokens (index.css)
public/        icons and favicon
scripts/       build helpers (budget check, icon generator)
tests/         test setup and mocks
docs/          requirements, architecture, UI rules, engineering, ADRs, traceability
```

## Rules

Read [`CLAUDE.md`](CLAUDE.md) and [`docs/README.md`](docs/README.md) before contributing. Changes go through pull requests into `main`; CI must be green.
