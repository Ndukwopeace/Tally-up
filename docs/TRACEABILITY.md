# Traceability — requirement → test → code

Updated in every feature pull request (ENG-9). Only requirements with code are listed; everything else is not built yet.

## Milestone 1

| Requirement | What it means | Tests | Code |
|---|---|---|---|
| Q-20, P-1, P-3 | Whole-number quantities; accept `1,500` / `1 500`; refuse decimal commas, negatives, exponents | `src/domain/quantity.test.ts` | `src/domain/quantity.ts` |
| REQUIREMENTS §11 (Q-6, Q-39, COL-11, PRD-04) | Business-rule values | `src/config/business-rules.test.ts` | `src/config/business-rules.ts` |
| REQUIREMENTS §7, H-2, Q-46, Q-47, Q-51 | Portal tabs; admin Home · Collections · Distributions · More; More page (incl. Audit log, Settings); account menu | `src/app/navigation.test.ts`, `src/app/router.test.tsx` | `src/app/navigation.ts`, `src/layouts/*`, `src/pages/AdminMorePage.tsx` |
| Q-50, WCAG 1.4.1 | Back arrow on sub-pages; logo → home; tabs replace history; no sideways swipe navigation; active tab marked by more than colour | `src/app/router.test.tsx` | `BackButton.tsx`, `BottomNav.tsx`, `PortalHeader.tsx`, `src/styles/index.css` |
| NFR-10, Q-6 | Today's date in Douala time on each home tab | `src/lib/format.test.ts`, `src/app/router.test.tsx` | `src/lib/format.ts`, `src/pages/HomePage.tsx` |
| ARCHITECTURE §4 | Routes for /admin, /distributor, /depot; Not Found | `src/app/router.test.tsx`, `src/app/App.test.tsx` | `src/app/router.tsx`, `src/pages/*` |
| NFR-11, WCAG 1.4.1, W-A3 | One status badge; text + icon + colour; five labels only; red only for discrepancy | `src/components/common/StatusBadge.test.tsx` | `src/components/common/StatusBadge.tsx` |
| MB-4, F-4, C-3, WCAG 3.3.1/3.3.2 | Large numeric quantity field with unit, linked errors | `src/components/common/QuantityInput.test.tsx` | `src/components/common/QuantityInput.tsx` |
| COL-09, D-1 | Submit disabled while saving; no double submit | `src/components/common/feedback.test.tsx` | `src/components/common/SubmitButton.tsx` |
| NFR-07, N9, C-5 | Loading, empty, error states | `src/components/common/feedback.test.tsx` | `EmptyState.tsx`, `ErrorState.tsx`, `PageSkeleton.tsx` |
| F-1 | 48px minimum targets; buttons never submit by accident | `src/components/common/feedback.test.tsx` | `src/components/ui/button.tsx` |
| NFR-06, Q-22 | "No connection" banner | `src/components/common/ConnectionBanner.test.tsx` | `ConnectionBanner.tsx`, `src/hooks/useOnlineStatus.ts` |
| NFR-05, ARCHITECTURE §11 | Installable PWA; update prompt, never auto-reload | `src/pwa/pwa.test.tsx` | `src/pwa/*`, `vite.config.ts`, `public/*` |
| WCAG 2.4.1, 2.4.2, J-1 | Skip link, page titles, bell top-right | `src/app/router.test.tsx` | `src/layouts/SkipLink.tsx`, `PortalHeader.tsx`, `src/pages/PlaceholderPage.tsx` |
| PERF-1, PERF-2 | Initial JS ≤ 250 KB gzipped; per-portal code splitting | CI `build` job (`npm run budget`) | `scripts/check-budget.mjs`, `src/app/router.tsx` |
| SEC-3, SEC-4 | No committed secrets | CI `secrets` job | `.github/workflows/ci.yml`, `.gitignore` |
| Q-45 | Wireframe truck logo; wordmark colours; icons drawn from the same shapes | `src/components/common/AppLogo.test.tsx` | `src/assets/logo-shapes.json`, `AppLogo.tsx`, `scripts/generate-icons.mjs`, `public/*` |
| SEC-10 | Security headers | Manual check on Vercel preview | `vercel.json` |
