/**
 * Reads the current sign-in state and the auth actions.
 *
 * WHY:  One hook for every component that needs to know who is signed in.
 * HOW:  useSyncExternalStore subscribes to the AuthStore, so a change (sign-in,
 *       sign-out, session expiry) re-renders every user of the hook at once,
 *       with no stale copies.
 * WHEN: Guards, auth pages, Profile, sign-out.
 * SECURITY: Read-only view of the state; changes go through the store's actions.
 */
import { use, useSyncExternalStore } from "react";

import { AuthContext } from "./AuthProvider";
import type { AuthState, AuthStore } from "./AuthStore";

export function useAuth(): { state: AuthState; store: AuthStore } {
  const store = use(AuthContext);
  if (!store) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return { state, store };
}
