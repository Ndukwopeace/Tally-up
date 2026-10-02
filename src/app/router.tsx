/**
 * Every route in Tally-Up, in one place (ARCHITECTURE §4).
 *
 * WHY:  One list makes it easy to see and review what each portal contains,
 *       and keeps /admin/*, /distributor/* and /depot/* separate (spec §38).
 * HOW:  React Router route objects. Each portal layout is loaded on demand
 *       (`lazy`), so a distributor's phone never downloads admin code (PERF-2).
 *       Pages below a portal's top level set `handle.backTo` (their parent), which
 *       makes the header show a Back arrow (Q-50). Unbuilt screens show
 *       "Coming soon" under their real title.
 * WHEN: Used by App.tsx (browser router) and router.test.tsx (memory router).
 * SECURITY: Milestone 2 wraps each portal in a role guard (AUTH-08). Guards are
 *       convenience only; the database enforces access (AUTH-10, ARCHITECTURE §4.5).
 */
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

// A page that is not a tab: shows "Coming soon" and a Back arrow to `parent`.
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
      // WORKAROUND (until Milestone 2): replaced by /login.
      { path: "/", element: <PreviewStartPage /> },
      {
        // RULE Q-47: Home · Collections · Distributions · More; bell + account menu.
        path: "/admin",
        lazy: async () => ({ Component: (await import("@/layouts/AdminLayout")).default }),
        children: [
          { index: true, element: <HomePage title={en.nav.home} /> },
          { path: "collections", element: <PlaceholderPage title={en.nav.collections} /> },
          { path: "distributions", element: <PlaceholderPage title={en.nav.distributions} /> },
          { path: "more", element: <AdminMorePage /> },
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
          { index: true, element: <HomePage title={en.nav.dashboard} /> },
          { path: "collections", element: <PlaceholderPage title={en.nav.collections} /> },
          { path: "distributions", element: <PlaceholderPage title={en.nav.distributions} /> },
          { path: "profile", element: <PlaceholderPage title={en.nav.profile} /> },
          subPage("notifications", en.nav.notifications, "/distributor"),
        ],
      },
      {
        // RULE REQUIREMENTS §7: Dashboard · Receipts · History · Profile.
        path: "/depot",
        lazy: async () => ({ Component: (await import("@/layouts/DepotLayout")).default }),
        children: [
          { index: true, element: <HomePage title={en.nav.dashboard} /> },
          { path: "receipts", element: <PlaceholderPage title={en.nav.receipts} /> },
          { path: "history", element: <PlaceholderPage title={en.nav.history} /> },
          { path: "profile", element: <PlaceholderPage title={en.nav.profile} /> },
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
