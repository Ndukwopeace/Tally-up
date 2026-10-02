/**
 * Who may enter which portal, and where each role lands (AUTH-07, AUTH-08, AUTH-09).
 *
 * WHY:  The same decisions are needed at start-up, after sign-in and in the
 *       route guards. One pure module keeps them identical everywhere.
 * HOW:  Plain functions over an Account; no React, no network.
 * WHEN: Used by auth/AuthStore.ts and auth/RequireRole.tsx.
 * SECURITY: Convenience only. The database refuses inactive accounts and
 *       wrong roles on every request (RLS, AUTH-10); these checks only stop
 *       the app from showing screens that would fail anyway.
 */
import type { Account } from "@/types/entities";
import type { Role } from "@/types/enums";

/**
 * RULE Q-55: portals open to sign-in. Admin first; Distributor and Depot
 * Manager are added when their milestones (D1, DM1) are delivered.
 */
export const OPEN_PORTALS: readonly Role[] = ["admin"];

/** RULE AUTH-07: each role's home after sign-in. */
export const PORTAL_HOME: Readonly<Record<Role, string>> = {
  admin: "/admin",
  distributor: "/distributor",
  depot_manager: "/depot",
};

/** Why an account that signed in correctly is still refused. */
export type AccessRefusal = "inactive" | "portal_not_open";

/** Null when the account may use the app, otherwise the reason it may not. */
export function accessRefusal(account: Account, openPortals: readonly Role[]): AccessRefusal | null {
  // RULE AUTH-09: deactivated users cannot log in.
  if (account.status !== "active") {
    return "inactive";
  }
  if (!openPortals.includes(account.role)) {
    return "portal_not_open";
  }
  return null;
}

/**
 * Where to go after signing in: back to the page the user originally asked for
 * (ARCHITECTURE §13 "return to page after sign-in") when it is inside their own
 * portal, otherwise their portal home.
 */
export function pathAfterSignIn(role: Role, requested?: string): string {
  const home = PORTAL_HOME[role];
  const insidePortal = requested === home || requested?.startsWith(`${home}/`) === true;
  // The sign-out page is never a destination: it would offer to sign out again at once.
  if (requested && insidePortal && !requested.endsWith("/sign-out")) {
    return requested;
  }
  return home;
}
