/**
 * The app's sign-in state and the actions that change it.
 *
 * WHY:  Every screen needs to know, at once and consistently, whether someone
 *       is signed in and as whom (AUTH-07, AUTH-08). The rules for refusing an
 *       account (AUTH-04, AUTH-09, Q-55) must apply the same way at start-up and
 *       at sign-in.
 * HOW:  A small observable store (plain TypeScript, no React) around an
 *       AuthService. React reads it through auth/AuthProvider.tsx with
 *       useSyncExternalStore. States:
 *         loading    → checking the saved session at start-up
 *         error      → that check failed (offline); the screen offers "Try again"
 *         signed_out → with an optional notice explaining a refusal
 *         signed_in  → with the account
 *       Actions return an error code (or null on success) instead of throwing,
 *       so forms can show a message directly.
 * WHEN: One store per page load, created in App.tsx; `start()` runs once then.
 * SECURITY: A refused account's Supabase session is ended immediately, so no
 *       valid token is left on the device for an account that may not use the
 *       app. A login counts only once the database has recorded it (AUD-03),
 *       which also re-checks the account is active on the server.
 */
import { accessRefusal, OPEN_PORTALS } from "./access";

import { AuthError, type AuthErrorCode, type AuthService } from "@/services/interfaces/AuthService";
import type { Account } from "@/types/entities";
import type { Role } from "@/types/enums";

export type AuthState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "signed_out"; notice: AuthErrorCode | null }
  | { status: "signed_in"; account: Account };

// Any failure as a code; unexpected errors count as "unavailable".
function codeOf(error: unknown): AuthErrorCode {
  return error instanceof AuthError ? error.code : "unavailable";
}

export class AuthStore {
  private state: AuthState = { status: "loading" };
  private readonly listeners = new Set<() => void>();
  private readonly stopListening: () => void;

  constructor(
    readonly service: AuthService,
    private readonly openPortals: readonly Role[] = OPEN_PORTALS,
  ) {
    // Session ended outside the app (expired, revoked, other tab): show signed out.
    this.stopListening = service.onSessionEnded(() => {
      if (this.state.status === "signed_in") {
        this.setState({ status: "signed_out", notice: null });
      }
    });
  }

  getState = (): AuthState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Checks the saved session. Also used by "Try again" after an error. */
  async start(): Promise<void> {
    this.setState({ status: "loading" });
    let account: Account | null;
    try {
      account = await this.service.getAccount();
    } catch (error) {
      const code = codeOf(error);
      // RULE AUTH-04: signed in to Supabase but no Tally-Up account → end that session.
      if (code === "no_account") {
        await this.endSession("no_account");
        return;
      }
      this.setState({ status: "error" });
      return;
    }
    if (account === null) {
      this.setState({ status: "signed_out", notice: null });
      return;
    }
    // RULE AUTH-09 / Q-55 (ARCHITECTURE §4.5): a saved session for a refused account is ended.
    const refusal = accessRefusal(account, this.openPortals);
    if (refusal) {
      await this.endSession(refusal);
      return;
    }
    this.setState({ status: "signed_in", account });
  }

  /** RULE AUTH-03: email + password. Returns null on success, else why it failed. */
  async signIn(email: string, password: string): Promise<AuthErrorCode | null> {
    let account: Account;
    try {
      // Spaces around a pasted email are never part of it.
      account = await this.service.signInWithPassword(email.trim(), password);
    } catch (error) {
      const code = codeOf(error);
      if (code === "no_account") {
        await this.endSession(code);
      }
      return code;
    }
    const refusal = accessRefusal(account, this.openPortals);
    if (refusal) {
      await this.endSession(refusal);
      return refusal;
    }
    // RULE AUD-03: the login is recorded before the app opens. If that fails, the
    // user is signed out again, so no login ever goes unrecorded.
    try {
      await this.service.recordLogin("password");
    } catch (error) {
      await this.endSession(null);
      return codeOf(error);
    }
    this.setState({ status: "signed_in", account });
    return null;
  }

  /** Ends the session on this device. The device is signed out even if the server is unreachable. */
  async signOut(): Promise<void> {
    await this.endSession(null);
  }

  /** RULE AUTH-06: emails a reset link. Returns null when the request was accepted. */
  async requestPasswordReset(email: string, redirectTo: string): Promise<AuthErrorCode | null> {
    try {
      await this.service.requestPasswordReset(email.trim(), redirectTo);
      return null;
    } catch (error) {
      return codeOf(error);
    }
  }

  /** Sets a new password for the signed-in account (reset link or Profile). */
  async updatePassword(newPassword: string): Promise<AuthErrorCode | null> {
    if (this.state.status !== "signed_in") {
      return "session_missing";
    }
    try {
      await this.service.updatePassword(newPassword);
      return null;
    } catch (error) {
      return codeOf(error);
    }
  }

  /** Stops listening to the service (tests; the app keeps one store for its lifetime). */
  dispose(): void {
    this.stopListening();
  }

  // Signs the device out, ignoring backend errors, and shows `notice` on the login page.
  private async endSession(notice: AuthErrorCode | null): Promise<void> {
    try {
      await this.service.signOut();
    } catch {
      // The device session is what matters, and it is gone; nothing to show.
    }
    this.setState({ status: "signed_out", notice });
  }

  private setState(next: AuthState): void {
    this.state = next;
    for (const listener of this.listeners) {
      listener();
    }
  }
}
