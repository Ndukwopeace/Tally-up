/**
 * AuthService backed by Supabase Auth and the `profiles` table (ARCHITECTURE §5).
 *
 * WHY:  The deployed app signs people in with Supabase (NFR-02, Q-37). Screens
 *       must not depend on Supabase's error shapes or wording.
 * HOW:  Thin calls to supabase-js. After any sign-in, the caller's `profiles`
 *       row is read and validated with Zod; that row, not auth metadata,
 *       decides the role (ARCHITECTURE §5.2). Every failure is converted to an
 *       `AuthError` code by `toAuthError`.
 * WHEN: Created once at start-up by services/index.ts in Supabase mode.
 * SECURITY: Reads go through the browser's public key, so RLS decides what is
 *       returned (AUTH-10). `user_metadata` is never used for roles because
 *       users can edit it. Raw server messages are never passed to the screen
 *       (they can reveal internals). Sign-out uses scope "local": it ends this
 *       device's session only, so signing out on a phone does not sign the
 *       admin out of other devices.
 */
import {
  isAuthApiError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
  isAuthWeakPasswordError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { z } from "zod/mini";

import { AuthError, type AuthService, type LoginMethod } from "@/services/interfaces/AuthService";
import type { Account } from "@/types/entities";
import { RECORD_STATUSES, ROLES } from "@/types/enums";

// SECURITY (SEC-5): the profile row is checked at the boundary; an unexpected
// shape (e.g. an unknown role) is refused rather than trusted.
const profileRowSchema = z.object({
  id: z.string().check(z.minLength(1)),
  full_name: z.string(),
  email: z.string(),
  role: z.enum(ROLES),
  status: z.enum(RECORD_STATUSES),
});

/** Converts anything supabase-js returns or throws into an AuthError with a known code. */
export function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) {
    return error;
  }
  if (isAuthWeakPasswordError(error)) {
    return new AuthError("weak_password");
  }
  if (isAuthSessionMissingError(error)) {
    return new AuthError("session_missing");
  }
  if (isAuthRetryableFetchError(error) || !isAuthApiError(error)) {
    return new AuthError("unavailable");
  }
  switch (error.code) {
    case "invalid_credentials":
      return new AuthError("invalid_credentials");
    // RULE AUTH-09: a deactivated account is banned in Supabase Auth (A2), so it cannot sign in.
    case "user_banned":
      return new AuthError("inactive");
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return new AuthError("rate_limited");
    case "weak_password":
      return new AuthError("weak_password");
    case "same_password":
      return new AuthError("same_password");
    case "session_not_found":
    case "session_expired":
      return new AuthError("session_missing");
    default:
      // Some rate-limit answers carry no code, only HTTP 429.
      return new AuthError(error.status === 429 ? "rate_limited" : "unavailable");
  }
}

// Runs a supabase-js call and turns both returned and thrown errors into AuthError.
async function run<T extends { error: unknown }>(call: () => Promise<T>): Promise<T> {
  let result: T;
  try {
    result = await call();
  } catch (error) {
    throw toAuthError(error);
  }
  if (result.error) {
    throw toAuthError(result.error);
  }
  return result;
}

export class SupabaseAuthService implements AuthService {
  constructor(private readonly client: SupabaseClient) {}

  async getAccount(): Promise<Account | null> {
    // Reads the stored session (refreshing it if needed); no profile query without one.
    const { data } = await run(() => this.client.auth.getSession());
    return data.session ? this.loadProfile(data.session.user.id) : null;
  }

  async signInWithPassword(email: string, password: string): Promise<Account> {
    const { data } = await run(() => this.client.auth.signInWithPassword({ email, password }));
    // A successful sign-in always carries a user; guard anyway rather than assume.
    if (!data.user) {
      throw new AuthError("unavailable");
    }
    return this.loadProfile(data.user.id);
  }

  async signOut(): Promise<void> {
    // supabase-js removes this device's session even when the server cannot be
    // reached, so the device is signed out either way; nothing to report.
    await this.client.auth.signOut({ scope: "local" });
  }

  async recordLogin(method: LoginMethod): Promise<void> {
    // RULE AUD-03: record_login() writes the entry for the caller (from the JWT) only.
    const { error } = await this.client.rpc("record_login", { login_method: method });
    if (error) {
      throw new AuthError(error.message === "NO_ACTIVE_ACCOUNT" ? "inactive" : "unavailable");
    }
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    // Supabase answers the same whether or not the email exists, so nobody can probe for accounts.
    await run(() => this.client.auth.resetPasswordForEmail(email, { redirectTo }));
  }

  async updatePassword(newPassword: string): Promise<void> {
    await run(() => this.client.auth.updateUser({ password: newPassword }));
  }

  onSessionEnded(listener: () => void): () => void {
    // Only SIGNED_OUT matters: the session expired, was revoked or ended in another tab.
    const { data } = this.client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        listener();
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }

  // Reads and validates the caller's own profile; RLS returns no other row (AUTH-10).
  private async loadProfile(userId: string): Promise<Account> {
    const { data, error } = await this.client
      .from("profiles")
      .select("id, full_name, email, role, status")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      throw new AuthError("unavailable");
    }
    // RULE AUTH-04: signed in to Supabase but unknown to Tally-Up.
    if (data === null) {
      throw new AuthError("no_account");
    }
    const row = profileRowSchema.safeParse(data);
    if (!row.success) {
      throw new AuthError("unavailable");
    }
    return {
      id: row.data.id,
      fullName: row.data.full_name,
      email: row.data.email,
      role: row.data.role,
      status: row.data.status,
    };
  }
}
