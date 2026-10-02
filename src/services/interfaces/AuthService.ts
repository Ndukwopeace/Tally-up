/**
 * What the app needs from an authentication backend (ARCHITECTURE §3.1, §5).
 *
 * WHY:  Pages and the auth store must not know whether Supabase or the test
 *       mock is behind them (NFR-03). One interface, two implementations:
 *       services/supabase/SupabaseAuthService.ts and services/mock/MockAuthService.ts.
 * HOW:  Every method either resolves or throws an `AuthError` whose `code` is
 *       one of `AUTH_ERROR_CODES`. Screens turn codes into plain messages from
 *       i18n/en.ts (ARCHITECTURE §13), never raw server text.
 * WHEN: Created once at start-up (services/index.ts) and used by auth/AuthStore.ts.
 * SECURITY: The interface carries no role decisions; those are made from the
 *       `profiles` row (ARCHITECTURE §5.2) and enforced again by RLS.
 */
import type { Account } from "@/types/entities";

/** Every reason an auth action can fail, as far as the user needs to know. */
export const AUTH_ERROR_CODES = [
  // Wrong email or password.
  "invalid_credentials",
  // Signed in to Supabase, but no Tally-Up profile exists (AUTH-04 wording).
  "no_account",
  // The account is deactivated (AUTH-09).
  "inactive",
  // The account's portal is not built yet (Q-55: admin only in A1).
  "portal_not_open",
  // Too many attempts or emails in a short time (Supabase limits).
  "rate_limited",
  // Supabase rejected the new password as too weak.
  "weak_password",
  // The new password is the same as the old one.
  "same_password",
  // No signed-in session, e.g. a reset link that expired or was already used.
  "session_missing",
  // Network down or an unexpected server answer.
  "unavailable",
] as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

/** The only error type auth services throw. */
export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode) {
    super(code);
    this.name = "AuthError";
    this.code = code;
  }
}

/** AUD-03: a login is by password or by Google. */
export type LoginMethod = "password" | "google";

export interface AuthService {
  /**
   * The account of the current session, or null when nobody is signed in.
   * Throws `no_account` when signed in but no profile exists.
   */
  getAccount(): Promise<Account | null>;
  /** Signs in and returns the account (which may still be inactive; the caller decides). */
  signInWithPassword(email: string, password: string): Promise<Account>;
  /** Ends this device's session. Throws `unavailable` if the server could not be told. */
  signOut(): Promise<void>;
  /** AUD-03: writes the login entry for the signed-in account. */
  recordLogin(method: LoginMethod): Promise<void>;
  /** AUTH-06: emails a reset link that opens `redirectTo`. Never says whether the email exists. */
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  /** Sets a new password for the signed-in account (reset link or Profile). */
  updatePassword(newPassword: string): Promise<void>;
  /** Calls `listener` when the session ends outside the app's control (expired, signed out in another tab). */
  onSessionEnded(listener: () => void): () => void;
}
