/**
 * Every route in Tally-Up, in one place (ARCHITECTURE §4).
 *
 * WHY:  One list makes it easy to see and review what each portal contains,
 *       and keeps /admin/*, /distributor/* and /depot/* separate (spec §38).
 * HOW:  React Router route objects. Each portal layout is loaded on demand
 *       (`lazy`), so a distributor's phone never downloads admin code (PERF-2).
 *       Pages inside a tab set `handle.backTo`, so they start with a Back link;
 *       Home and tab screens have none (Q-56). Unbuilt screens show
 *       "Coming soon" under their real title. Public pages (login, forgot and
 *       reset password) sit outside the portals (ARCHITECTURE §4.1).
 * WHEN: Used by App.tsx (browser router) and router.test.tsx (memory router).
 * SECURITY: Each portal is wrapped in RequireRole (AUTH-08): signed-out visitors
 *       go to /login and other roles to their own portal. Guards are convenience
 *       only; the database enforces access (AUTH-10, ARCHITECTURE §4.5).
 */
import type { ComponentType, ReactElement } from "react";
import { createBrowserRouter, type RouteObject } from "react-router";

import { RootLayout } from "./RootLayout";

import { RequireRole, StartRedirect } from "@/auth/RequireRole";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import { en } from "@/i18n/en";
import type { RouteHandle } from "@/layouts/MobilePortalLayout";
import { AdminMorePage } from "@/pages/AdminMorePage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { ProfilePage } from "@/pages/ProfilePage";

// RULE Q-56: Back only moves back inside a tab, sits below the header (away from
// the logo) and never signs out. Four kinds of screen:

// A portal's home tab: no Back (nothing earlier inside the tab).
function homeRoute(title: string): RouteObject {
  return { index: true, element: <HomePage title={title} /> };
}

// Any other bottom tab: no Back. Moving between tabs is done with the tabs themselves.
function tabRoute(path: string, element: ReactElement): RouteObject {
  return { path, element };
}

// A page inside a tab (More → Depots, …); "Coming soon" unless `element` is given.
// Back always returns to `parent` in the same tab, never to another tab.
function subPage(path: string, title: string, parent: string, element?: ReactElement): RouteObject {
  const handle: RouteHandle = { backTo: parent, backToParentOnly: true };
  return { path, element: element ?? <PlaceholderPage title={title} />, handle };
}

// Like subPage, for a built screen whose code downloads only when first opened
// (PERF-2): the loading bar shows meanwhile (Q-56).
function lazySubPage(path: string, parent: string, load: () => Promise<ComponentType>): RouteObject {
  const handle: RouteHandle = { backTo: parent, backToParentOnly: true };
  return { path, handle, lazy: async () => ({ Component: await load() }) };
}

// A page opened from the header (bell, account menu). Back returns to the page it was
// opened from; opened directly (link, refresh) it goes to the portal home.
function headerPage(path: string, title: string, home: string, element?: ReactElement): RouteObject {
  const handle: RouteHandle = { backTo: home };
  return { path, element: element ?? <PlaceholderPage title={title} />, handle };
}

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    // Shown while a portal's code is downloading for the first time (D-2).
    hydrateFallbackElement: <PageSkeleton />,
    children: [
      // RULE AUTH-07: "/" sends a signed-in user to their portal, everyone else to /login.
      { path: "/", element: <StartRedirect /> },
      // RULE AUTH-01: public pages. No signup page exists (AUTH-02).
      { path: "/login", element: <LoginPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      { path: "/reset-password", element: <ResetPasswordPage /> },
      {
        // RULE Q-47: Home · Collections · Distributions · More; bell + account menu.
        path: "/admin",
        element: <RequireRole allow="admin" />,
        children: [
          {
            lazy: async () => ({ Component: (await import("@/layouts/AdminLayout")).default }),
            children: [
              homeRoute(en.nav.home),
              tabRoute("collections", <PlaceholderPage title={en.nav.collections} />),
              tabRoute("distributions", <PlaceholderPage title={en.nav.distributions} />),
              tabRoute("more", <AdminMorePage />),
              subPage("depots", en.nav.depots, "/admin/more"),
              // A2a: products (PRD-01 to PRD-05).
              lazySubPage(
                "products",
                "/admin/more",
                async () => (await import("@/pages/admin/ProductsPage")).ProductsPage,
              ),
              lazySubPage(
                "products/new",
                "/admin/products",
                async () => (await import("@/pages/admin/ProductFormPage")).NewProductPage,
              ),
              lazySubPage(
                "products/:productId",
                "/admin/products",
                async () => (await import("@/pages/admin/ProductFormPage")).EditProductPage,
              ),
              subPage("users", en.nav.users, "/admin/more"),
              subPage("reports", en.nav.reports, "/admin/more"),
              subPage("audit", en.nav.audit, "/admin/more"),
              subPage("settings", en.nav.settings, "/admin/more"),
              headerPage("profile", en.nav.profileAccount, "/admin", <ProfilePage />),
              headerPage("notifications", en.nav.notifications, "/admin"),
            ],
          },
        ],
      },
      {
        // RULE Q-46: Dashboard · Collections · Distributions · Profile.
        // Q-55: built and guarded, but no distributor can sign in until milestone D1.
        path: "/distributor",
        element: <RequireRole allow="distributor" />,
        children: [
          {
            lazy: async () => ({ Component: (await import("@/layouts/DistributorLayout")).default }),
            children: [
              homeRoute(en.nav.dashboard),
              tabRoute("collections", <PlaceholderPage title={en.nav.collections} />),
              tabRoute("distributions", <PlaceholderPage title={en.nav.distributions} />),
              tabRoute("profile", <PlaceholderPage title={en.nav.profile} />),
              headerPage("notifications", en.nav.notifications, "/distributor"),
            ],
          },
        ],
      },
      {
        // RULE REQUIREMENTS §7: Dashboard · Receipts · History · Profile.
        // Q-55: built and guarded, but no depot manager can sign in until milestone DM1.
        path: "/depot",
        element: <RequireRole allow="depot_manager" />,
        children: [
          {
            lazy: async () => ({ Component: (await import("@/layouts/DepotLayout")).default }),
            children: [
              homeRoute(en.nav.dashboard),
              tabRoute("receipts", <PlaceholderPage title={en.nav.receipts} />),
              tabRoute("history", <PlaceholderPage title={en.nav.history} />),
              tabRoute("profile", <PlaceholderPage title={en.nav.profile} />),
              headerPage("notifications", en.nav.notifications, "/depot"),
            ],
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

/** The router used in the real app; reads and writes the browser address bar. */
export function createAppRouter() {
  return createBrowserRouter(routes);
}
