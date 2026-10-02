/**
 * Route guard: only the right, signed-in role sees a portal (AUTH-08, ARCHITECTURE §4.5).
 *
 * WHY:  Typed or bookmarked URLs must not open another role's portal, and a
 *       signed-out visitor must be sent to the login page.
 * HOW:  Wraps a portal's routes (<Outlet/>):
 *         checking       → skeleton
 *         check failed   → error with "Try again"
 *         signed out     → /login, remembering the requested page
 *         wrong role     → the user's own portal home, without saying what exists
 *         right role     → the portal
 *       Refused accounts (inactive, portal not open) never reach "signed in";
 *       the AuthStore signs them out first.
 * WHEN: Around /admin/*, /distributor/* and /depot/* in router.tsx.
 * SECURITY: Convenience only. The database refuses every request a role may
 *       not make (RLS, AUTH-10); this guard just avoids showing screens that
 *       would fail anyway.
 */
import { Navigate, Outlet, useLocation } from "react-router";

import { PORTAL_HOME } from "./access";
import { CheckingSignIn, SignInCheckFailed } from "./StartupScreens";
import { useAuth } from "./useAuth";

import type { Role } from "@/types/enums";

export function RequireRole({ allow }: Readonly<{ allow: Role }>) {
  const { state } = useAuth();
  const location = useLocation();

  switch (state.status) {
    case "loading":
      return <CheckingSignIn />;
    case "error":
      return <SignInCheckFailed />;
    case "signed_out":
      // ARCHITECTURE §13: after signing in, return to the page that was asked for.
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    case "signed_in":
      // RULE AUTH-08: another portal's URL leads to your own portal.
      return state.account.role === allow ? (
        <Outlet />
      ) : (
        <Navigate to={PORTAL_HOME[state.account.role]} replace />
      );
  }
}

/** "/" — RULE AUTH-07: your own portal when signed in, otherwise the login page. */
export function StartRedirect() {
  const { state } = useAuth();
  switch (state.status) {
    case "loading":
      return <CheckingSignIn />;
    case "error":
      return <SignInCheckFailed />;
    case "signed_out":
      return <Navigate to="/login" replace />;
    case "signed_in":
      return <Navigate to={PORTAL_HOME[state.account.role]} replace />;
  }
}
