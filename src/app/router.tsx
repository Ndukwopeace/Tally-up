/**
 * Every route in Tally-Up, in one place (ARCHITECTURE §4).
 *
 * WHY:  One list makes it easy to see and review what each portal contains,
 *       and keeps /admin/*, /distributor/* and /depot/* separate (spec §38).
 * HOW:  React Router route objects. Each portal layout is loaded on demand
 *       (`lazy`), so a distributor's phone never downloads admin code (PERF-2).
 *       Every portal screen sets `handle.backTo`, so the header always shows a
 *       Back arrow (Q-50, Q-53). Unbuilt screens show
 *       "Coming soon" under their real title.
 * WHEN: Used by App.tsx (browser router) and router.test.tsx (memory router).
 * SECURITY: Milestone 2 wraps each portal in a role guard (AUTH-08). Guards are
 *       convenience only; the database enforces access (AUTH-10, ARCHITECTURE §4.5).
 */
import type { ReactElement } from "react";
import { createBrowserRouter, type RouteObject } from "react-router";

import { RootLayout } from "./RootLayout";

import { PageSkeleton } from "@/components/common/PageSkeleton";
import { en } from "@/i18n/en";
import type { RouteHandle } from "@/layouts/MobilePortalLayout";
import { AdminMorePage } from "@/pages/AdminMorePage";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { PreviewStartPage } from "@/pages/PreviewStartPage";

// WORKAROUND (until Milestone 2): the start page; becomes the login page.
const START_PAGE = "/";

// RULE Q-53: every portal screen has a Back arrow. Three kinds of screen:

// A portal's home tab. Back goes to the previous page (the start page for now),
// or to START_PAGE when the app was opened straight onto home.
function homeRoute(title: string): RouteObject {
  const handle: RouteHandle = { backTo: START_PAGE };
  return { index: true, element: <HomePage title={title} />, handle };
}

// Any other bottom tab. Back always goes to the portal's home, because tabs do not
// add history (Q-50) and "one step back" would skip the home screen.
function tabRoute(path: string, home: string, element: ReactElement): RouteObject {
  const handle: RouteHandle = { backTo: home, backToParentOnly: true };
  return { path, element, handle };
}

// A page inside a tab (from More, the bell or the account menu): "Coming soon" for now.
// Back goes to the previous page, or to `parent` when opened directly.
function subPage(path: string, title: string, parent: string): RouteObject {
  const handle: RouteHandle = { backTo: parent };
  return { path, element: <PlaceholderPage title={title} />, handle };
}

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    // Shown while a portal's code is downloading for the first time (D-2).
    hydrateFallbackElement: <PageSkeleton />,
    children: [
      { path: START_PAGE, element: <PreviewStartPage /> },
      {
        // RULE Q-47: Home · Collections · Distributions · More; bell + account menu.
        path: "/admin",
        lazy: async () => ({ Component: (await import("@/layouts/AdminLayout")).default }),
        children: [
          homeRoute(en.nav.home),
          tabRoute("collections", "/admin", <PlaceholderPage title={en.nav.collections} />),
          tabRoute("distributions", "/admin", <PlaceholderPage title={en.nav.distributions} />),
          tabRoute("more", "/admin", <AdminMorePage />),
          subPage("depots", en.nav.depots, "/admin/more"),
          subPage("products", en.nav.products, "/admin/more"),
          subPage("users", en.nav.users, "/admin/more"),
          subPage("reports", en.nav.reports, "/admin/more"),
          subPage("audit", en.nav.audit, "/admin/more"),
          subPage("settings", en.nav.settings, "/admin/more"),
          subPage("profile", en.nav.profileAccount, "/admin"),
          subPage("notifications", en.nav.notifications, "/admin"),
        ],
      },
      {
        // RULE Q-46: Dashboard · Collections · Distributions · Profile.
        path: "/distributor",
        lazy: async () => ({ Component: (await import("@/layouts/DistributorLayout")).default }),
        children: [
          homeRoute(en.nav.dashboard),
          tabRoute("collections", "/distributor", <PlaceholderPage title={en.nav.collections} />),
          tabRoute("distributions", "/distributor", <PlaceholderPage title={en.nav.distributions} />),
          tabRoute("profile", "/distributor", <PlaceholderPage title={en.nav.profile} />),
          subPage("notifications", en.nav.notifications, "/distributor"),
        ],
      },
      {
        // RULE REQUIREMENTS §7: Dashboard · Receipts · History · Profile.
        path: "/depot",
        lazy: async () => ({ Component: (await import("@/layouts/DepotLayout")).default }),
        children: [
          homeRoute(en.nav.dashboard),
          tabRoute("receipts", "/depot", <PlaceholderPage title={en.nav.receipts} />),
          tabRoute("history", "/depot", <PlaceholderPage title={en.nav.history} />),
          tabRoute("profile", "/depot", <PlaceholderPage title={en.nav.profile} />),
          subPage("notifications", en.nav.notifications, "/depot"),
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
