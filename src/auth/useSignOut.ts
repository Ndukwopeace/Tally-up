/**
 * Signs the user out straight away and reports progress (Q-56).
 *
 * WHY:  The owner decided Sign Out acts at once, with no confirmation page, and
 *       that every action shows it is working (N1, D-1). One hook keeps the
 *       account menu and Profile identical.
 * HOW:  `signOut()` sets `signingOut` (so the button can show "Signing out…"),
 *       then ends the session through the AuthStore. The portal's route guard
 *       then replaces the page with /login, in place, so Back cannot reopen the portal.
 * WHEN: Sign Out in the admin account menu and on Profile.
 * SECURITY: Ends this device's Supabase session; the device holds no valid token
 *       afterwards, even if the server could not be reached.
 */
import { useState } from "react";

import { useAuth } from "./useAuth";

export function useSignOut(): { signOut: () => Promise<void>; signingOut: boolean } {
  const { store } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await store.signOut();
  }

  return { signOut, signingOut };
}
