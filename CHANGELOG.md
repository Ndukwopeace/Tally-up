# Changelog

All notable changes to Tally-Up. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions: [Semantic Versioning](https://semver.org/), `0.<milestone>.<patch>` until go-live (ENG-8).

## [Unreleased]

### Changed
- Admin is phone-first (Q-48) with bottom tabs Home · Collections · Distributions · More, a More page (Depots, Products, Users, Reports), and an account menu (Profile / My Account, Sign Out) next to the bell (Q-47).
- Back arrow on every screen (Q-53): tab screens go back to their portal home, home goes back to the start page, Page not found has Back too.
- Start page layout A (Q-54): logo at the top, heading and portal choices at the bottom, within thumb reach.
- More page also holds Audit log and Settings (Q-51). Milestone plan re-cut role by role (Q-52).
- Distributor tabs: Dashboard · Collections · Distributions · Profile; History tab removed (Q-46).
- Navigation (Q-50): Back arrow on every sub-page; logo returns home; tabs no longer add browser history; sideways swipe-navigation turned off where the browser allows.
- UI review fixes: status-bar safe area, active tab marked with a pill (not colour alone), white status-bar colour, plain "Coming soon" wording, stronger card borders, larger logo, aligned header width, today's date on home tabs, clearer start page, branded Not Found page, iPhone install instructions.
- Logo replaced with the wireframe truck logo (Q-45): header, sidebar, favicon and all app icons now share one shape file (`src/assets/logo-shapes.json`).

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
- CI: removed the temporary `project` guard job; all checks now always run.
