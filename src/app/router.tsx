/**
 * Every route in Tally-Up, in one place (ARCHITECTURE §4).
 *
 * WHY:  One list makes it easy to see and review what each portal contains,
 *       and keeps /admin/*, /distributor/* and /depot/* separate (spec §38).
 * HOW:  React Router route objects. Each portal layout is loaded on demand
 *       (`lazy`), so a distributor's phone never downloads admin code (PERF-2).
 *       Milestone 1 pages are placeholders naming the milestone that builds them.
 * WHEN: Used by App.tsx (browser router) and router.test.tsx (memory router).
 * SECURITY: Milestone 2 wraps each portal in a role guard (AUTH-08). Guards are
 *       convenience only; the database enforces access (AUTH-10, ARCHITECTURE §4.5).
 */
import { createBrowserRouter, type RouteObject } from "react-router";

import { RootLayout } from "./RootLayout";

import { PageSkeleton } from "@/components/common/PageSkeleton";
import { en } from "@/i18n/en";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
import { PreviewStartPage } from "@/pages/PreviewStartPage";

// Milestone that builds each screen (REQUIREMENTS §13). Used only by placeholders.
const M = { auth: 2, distributor: 4, depot: 5, adminMonitoring: 6 } as const;

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    // Shown while a portal's code is downloading for the first time (D-2).
    hydrateFallbackElement: <PageSkeleton />,
    children: [
      // WORKAROUND (Milestone 1 only): replaced by /login in Milestone 2.
      { path: "/", element: <PreviewStartPage /> },
      {
        path: "/admin",
        lazy: async () => ({ Component: (await import("@/layouts/AdminLayout")).default }),
        children: [
          {
            index: true,
            element: <PlaceholderPage title={en.pages.adminDashboard} milestone={M.adminMonitoring} />,
          },
          {
            path: "notifications",
            element: <PlaceholderPage title={en.nav.notifications} milestone={M.adminMonitoring} />,
          },
        ],
      },
      {
        path: "/distributor",
        lazy: async () => ({ Component: (await import("@/layouts/DistributorLayout")).default }),
        children: [
          {
            index: true,
            element: <PlaceholderPage title={en.pages.distributorDashboard} milestone={M.distributor} />,
          },
          {
            path: "collections",
            element: <PlaceholderPage title={en.nav.collections} milestone={M.distributor} />,
          },
          {
            path: "distributions",
            element: <PlaceholderPage title={en.nav.distributions} milestone={M.distributor} />,
          },
          { path: "history", element: <PlaceholderPage title={en.nav.history} milestone={M.distributor} /> },
          { path: "profile", element: <PlaceholderPage title={en.nav.profile} milestone={M.auth} /> },
          {
            path: "notifications",
            element: <PlaceholderPage title={en.nav.notifications} milestone={M.adminMonitoring} />,
          },
        ],
      },
      {
        path: "/depot",
        lazy: async () => ({ Component: (await import("@/layouts/DepotLayout")).default }),
        children: [
          { index: true, element: <PlaceholderPage title={en.pages.depotDashboard} milestone={M.depot} /> },
          { path: "receipts", element: <PlaceholderPage title={en.nav.receipts} milestone={M.depot} /> },
          { path: "history", element: <PlaceholderPage title={en.nav.history} milestone={M.depot} /> },
          { path: "profile", element: <PlaceholderPage title={en.nav.profile} milestone={M.auth} /> },
          {
            path: "notifications",
            element: <PlaceholderPage title={en.nav.notifications} milestone={M.adminMonitoring} />,
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
