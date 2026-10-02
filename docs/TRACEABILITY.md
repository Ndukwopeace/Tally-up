# Traceability — requirement → test → code

Updated in every feature pull request (ENG-9). Only requirements with code are listed; everything else is not built yet.

## Milestone 1

| Requirement | What it means | Tests | Code |
|---|---|---|---|
| Q-20, P-1, P-3 | Whole-number quantities; accept `1,500` / `1 500`; refuse decimal commas, negatives, exponents | `src/domain/quantity.test.ts` | `src/domain/quantity.ts` |
| REQUIREMENTS §11 (Q-6, Q-39, COL-11, PRD-04) | Business-rule values | `src/config/business-rules.test.ts` | `src/config/business-rules.ts` |
| REQUIREMENTS §7, H-2, Q-46, Q-47, Q-51 | Portal tabs; admin Home · Collections · Distributions · More; More page (incl. Audit log, Settings); account menu | `src/app/navigation.test.ts`, `src/app/router.test.tsx` | `src/app/navigation.ts`, `src/layouts/*`, `src/pages/AdminMorePage.tsx` |
| Q-50, Q-53, Q-54, WCAG 1.4.1 | Back arrow on every screen (tab screens → home; sub-pages → previous/parent); start page layout A; logo → home; tabs replace history; no sideways swipe navigation; active tab marked by more than colour | `src/app/router.test.tsx` | `BackButton.tsx`, `BottomNav.tsx`, `PortalHeader.tsx`, `src/styles/index.css` |
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

## A1 — Admin login

| Requirement | What it means | Tests | Code |
|---|---|---|---|
| AUTH-01, AUTH-02 | `/login`, `/forgot-password`, `/reset-password`; no signup anywhere | `src/pages/auth/LoginPage.test.tsx`, `PasswordPages.test.tsx` | `src/app/router.tsx`, `src/pages/auth/*` |
| AUTH-03 | Email + password sign-in; field checks | `LoginPage.test.tsx`, `src/domain/validation.test.ts`, `src/auth/AuthStore.test.ts` | `LoginPage.tsx`, `src/domain/validation.ts`, `src/auth/AuthStore.ts` |
| AUTH-04 | No profile → "No Tally-Up account exists…"; session ended | `AuthStore.test.ts`, `LoginPage.test.tsx`, `SupabaseAuthService.test.ts` | `AuthStore.ts`, `SupabaseAuthService.ts` |
| AUTH-05 | Google shown, disabled, "Not available yet" | `LoginPage.test.tsx` | `LoginPage.tsx` |
| AUTH-06 | Reset email → `/reset-password`; same answer for any email | `PasswordPages.test.tsx` | `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `NewPasswordForm.tsx` |
| AUTH-07 | `/` and sign-in route each role to its portal; return to requested page | `src/auth/RequireRole.test.tsx`, `src/auth/access.test.ts` | `src/auth/RequireRole.tsx`, `src/auth/access.ts` |
| AUTH-08 | Guards on every portal, typed URLs included | `RequireRole.test.tsx` | `RequireRole.tsx`, `router.tsx` |
| AUTH-09 | Inactive accounts refused (app and database) | `AuthStore.test.ts`, `LoginPage.test.tsx`, `supabase/tests/a1_profiles_audit.test.sql` | `access.ts`, `supabase/migrations/20261002120000_a1_profiles_and_audit.sql` |
| AUTH-10, SEC-12 | RLS: own profile only; active admin reads all; no direct writes; anon sees nothing | `supabase/tests/a1_profiles_audit.test.sql` (35 checks) | migration above |
| AUD-02, AUD-03 | Login recorded (who, action, record, time, method); refused if not recordable | `a1_profiles_audit.test.sql`, `AuthStore.test.ts`, `SupabaseAuthService.test.ts` | `record_login()` in the migration, `AuthStore.ts` |
| Q-55 | Only the admin portal open; others refused with a reason | `RequireRole.test.tsx`, `access.test.ts` | `OPEN_PORTALS` in `access.ts` |
| §7 Profile, Q-47 | Profile: name, email, role, change password, sign out | `src/pages/AccountPages.test.tsx` | `src/pages/ProfilePage.tsx` |
| Q-56 | Back only on pages inside a tab or opened from the header, below the header, never changes tab, never signs out; Sign Out acts at once with "Signing out…"; loading bar and press feedback | `router.test.tsx`, `AccountPages.test.tsx`, `src/app/NavigationProgress.test.tsx`, `PasswordPages.test.tsx` | `src/layouts/BackButton.tsx`, `MobilePortalLayout.tsx`, `AccountMenu.tsx`, `src/auth/useSignOut.ts`, `src/app/NavigationProgress.tsx`, `router.tsx` |
| NFR-03, NFR-13, SEC-4 | Supabase in deployed builds; mock only in development; secret keys refused at build | `src/config/env.test.ts`, `src/services/index.test.ts`, `tooling/supabase-public-env.test.ts` | `src/config/env.ts`, `src/services/index.ts`, `tooling/supabase-public-env.ts`, `vite.config.ts` |
| NFR-06 | No sign-in or password changes offline | `LoginPage.test.tsx`, `PasswordPages.test.tsx` | `LoginPage.tsx`, `NewPasswordForm.tsx`, `ForgotPasswordPage.tsx` |
| SEC-10 | CSP allows only this site and Supabase for data connections | Manual check on Vercel preview | `vercel.json` |

## A2a — Products

| Requirement | What it means | Tests | Code |
|---|---|---|---|
| PRD-01 | Create, edit, activate/deactivate; no delete | `supabase/tests/a2a_products.test.sql`, `src/pages/admin/ProductPages.test.tsx` | `supabase/migrations/20261002130*_a2a_*.sql` (`admin_save_product`), `src/pages/admin/*` |
| PRD-02, Q-57h, Q-57j | Name, code (letters/numbers/dashes ≤ 20, unique ignoring case); description optional | `src/domain/products.test.ts`, `a2a_products.test.sql`, `ProductPages.test.tsx` | `src/domain/products.ts`, migration |
| PRD-03, Q-57d | Loaf always; Pack and Caisse optional | `products.test.ts`, `a2a_products.test.sql` | `products.ts`, migration |
| PRD-04, PRD-05 | Loaves per Pack/Caisse required, whole, ≥ 1; Caisse entered in loaves or packs, stored in loaves | `products.test.ts`, `ProductPages.test.tsx`, `a2a_products.test.sql` | `products.ts`, `ProductFormPage.tsx` |
| PRD-07, §6.5 | Distributors read active products only; managers all; no direct writes | `a2a_products.test.sql` | migration (RLS) |
| AUD-03 | Product created / edited / (de)activated logged | `a2a_products.test.sql` | `admin_save_product` |
| NFR-07, NFR-06 | Loading, empty, error; no saving offline | `ProductPages.test.tsx` | `ProductsPage.tsx`, `ProductFormPage.tsx` |
