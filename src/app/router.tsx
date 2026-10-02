/**
 * Every route in Tally-Up, in one place (ARCHITECTURE §4).
 *
 * WHY:  One list makes it easy to see and review what each portal contains,
 *       and keeps /admin/*, /distributor/* and /depot/* separate (spec §38).
 * HOW:  React Router route objects. Each portal layout is loaded on demand
 *       (`lazy`), so a distributor's phone never downloads admin code (PERF-2).
 *       Every portal screen sets `handle.backTo`, so the header always shows a
 *       Back arrow (Q-50, Q-53). Unbuilt screens show
 *       "Coming soon" under their real title. Public pages (login, forgot and
 *       reset password) sit outside the portals (ARCHITECTURE §4.1).
 * WHEN: Used by App.tsx (browser router) and router.test.tsx (memory router).
 * SECURITY: Each portal is wrapped in RequireRole (AUTH-08): signed-out visitors
 *       go to /login and other roles to their own portal. Guards are convenience
 *       only; the database enforces access (AUTH-10, ARCHITECTURE §4.5).
 */
import type { ReactElement } from "react";
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
import { SignOutPage } from "@/pages/SignOutPage";

// RULE Q-53: every portal screen has a Back arrow. Four kinds of screen:

// A portal's home tab. There is nothing earlier in the app to go back to, so
// Back asks "Sign out?" (the portal's sign-out page) instead of leaving silently.
function homeRoute(title: string, home: string): RouteObject {
  const handle: RouteHandle = { backTo: `${home}/sign-out`, backToParentOnly: true };
  return { index: true, element: <HomePage title={title} />, handle };
}

// The "Sign out?" page. Back returns to where the user came from (usually Home).
function signOutRoute(home: string): RouteObject {
  const handle: RouteHandle = { backTo: home };
  return { path: "sign-out", element: <SignOutPage />, handle };
}

// Any other bottom tab. Back always goes to the portal's home, because tabs do not
// add history (Q-50) and "one step back" would skip the home screen.
function tabRoute(path: string, home: string, element: ReactElement): RouteObject {
  const handle: RouteHandle = { backTo: home, backToParentOnly: true };
  return { path, element, handle };
}

// A page inside a tab (from More, the bell or the account menu); "Coming soon" unless
// `element` is given. Back goes to the previous page, or to `parent` when opened directly.
function subPage(path: string, title: string, parent: string, element?: ReactElement): RouteObject {
  const handle: RouteHandle = { backTo: parent };
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
              homeRoute(en.nav.home, "/admin"),
              tabRoute("collections", "/admin", <PlaceholderPage title={en.nav.collections} />),
              tabRoute("distributions", "/admin", <PlaceholderPage title={en.nav.distributions} />),
              tabRoute("more", "/admin", <AdminMorePage />),
              subPage("depots", en.nav.depots, "/admin/more"),
              subPage("products", en.nav.products, "/admin/more"),
              subPage("users", en.nav.users, "/admin/more"),
              subPage("reports", en.nav.reports, "/admin/more"),
              subPage("audit", en.nav.audit, "/admin/more"),
              subPage("settings", en.nav.settings, "/admin/more"),
              subPage("profile", en.nav.profileAccount, "/admin", <ProfilePage />),
              subPage("notifications", en.nav.notifications, "/admin"),
              signOutRoute("/admin"),
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
              homeRoute(en.nav.dashboard, "/distributor"),
              tabRoute("collections", "/distributor", <PlaceholderPage title={en.nav.collections} />),
              tabRoute("distributions", "/distributor", <PlaceholderPage title={en.nav.distributions} />),
              tabRoute("profile", "/distributor", <PlaceholderPage title={en.nav.profile} />),
              subPage("notifications", en.nav.notifications, "/distributor"),
              signOutRoute("/distributor"),
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
              homeRoute(en.nav.dashboard, "/depot"),
              tabRoute("receipts", "/depot", <PlaceholderPage title={en.nav.receipts} />),
              tabRoute("history", "/depot", <PlaceholderPage title={en.nav.history} />),
              tabRoute("profile", "/depot", <PlaceholderPage title={en.nav.profile} />),
              subPage("notifications", en.nav.notifications, "/depot"),
              signOutRoute("/depot"),
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
