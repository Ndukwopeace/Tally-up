/**
 * Makes the auth store available to every component.
 *
 * WHY:  Guards, pages and the account menu all need the same sign-in state
 *       (ARCHITECTURE §3.2 `auth/AuthProvider.tsx`).
 * HOW:  A React context holding the one AuthStore. Components read it with
 *       `useAuth()` (auth/useAuth.ts).
 * WHEN: Wraps the router in App.tsx; tests wrap routes with their own store.
 * SECURITY: Holds no secrets; the session tokens stay inside supabase-js.
 */
import { createContext, type ReactNode } from "react";

import type { AuthStore } from "./AuthStore";

export const AuthContext = createContext<AuthStore | null>(null);

export function AuthProvider({ store, children }: Readonly<{ store: AuthStore; children: ReactNode }>) {
  return <AuthContext value={store}>{children}</AuthContext>;
}
