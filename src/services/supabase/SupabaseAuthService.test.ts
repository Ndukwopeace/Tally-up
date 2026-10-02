/**
 * Tests for the Supabase implementation of AuthService.
 *
 * Rules under test:
 *  - ARCHITECTURE §5.2: the role comes from the `profiles` row, never from
 *    user-editable auth metadata.
 *  - AUTH-04 / AUTH-09: no profile → no_account; banned (deactivated) → inactive.
 *  - AUD-03: logins are written through the record_login database function.
 *  - ARCHITECTURE §13: Supabase errors become plain codes; raw text never leaks.
 * The Supabase client is replaced by a fake, so no network is used.
 */
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthWeakPasswordError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { SupabaseAuthService } from "./SupabaseAuthService";

import { AuthError, type AuthErrorCode } from "@/services/interfaces/AuthService";

const ROW = { id: "u-1", full_name: "Ama Admin", email: "ama@example.test", role: "admin", status: "active" };
const ACCOUNT = {
  id: "u-1",
  fullName: "Ama Admin",
  email: "ama@example.test",
  role: "admin",
  status: "active",
};

// Builds a fake client. `profile` is what the profiles query returns.
function fakeClient(profile: { data: unknown; error: unknown } = { data: ROW, error: null }) {
  const maybeSingle = vi.fn().mockResolvedValue(profile);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  let authListener: ((event: string) => void) | undefined;
  const unsubscribe = vi.fn();
  const client = {
    from: vi.fn().mockReturnValue({ select }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "u-1" } } }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
      onAuthStateChange: vi.fn((callback: (event: string) => void) => {
        authListener = callback;
        return { data: { subscription: { unsubscribe } } };
      }),
    },
  };
  return {
    client,
    service: new SupabaseAuthService(client as unknown as SupabaseClient),
    select,
    eq,
    unsubscribe,
    emit: (event: string) => authListener?.(event),
  };
}

async function expectCode(promise: Promise<unknown>, code: AuthErrorCode) {
  await expect(promise).rejects.toEqual(new AuthError(code));
}

describe("SupabaseAuthService.getAccount", () => {
  it("returns null when there is no session, without querying profiles", async () => {
    const { client, service } = fakeClient();
    client.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await service.getAccount()).toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("reads the role from the caller's profiles row (ARCHITECTURE §5.2)", async () => {
    const { client, service, select, eq } = fakeClient();
    expect(await service.getAccount()).toEqual(ACCOUNT);
    expect(client.from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("id, full_name, email, role, status");
    expect(eq).toHaveBeenCalledWith("id", "u-1");
  });

  it("throws no_account when signed in without a profile (AUTH-04)", async () => {
    const { service } = fakeClient({ data: null, error: null });
    await expectCode(service.getAccount(), "no_account");
  });

  it("throws unavailable when the profile cannot be read or is malformed", async () => {
    await expectCode(
      fakeClient({ data: null, error: { message: "boom" } }).service.getAccount(),
      "unavailable",
    );
    await expectCode(
      fakeClient({ data: { ...ROW, role: "owner" }, error: null }).service.getAccount(),
      "unavailable",
    );
  });

  it("maps a session error", async () => {
    const { client, service } = fakeClient();
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: new AuthRetryableFetchError("x", 0),
    });
    await expectCode(service.getAccount(), "unavailable");
  });
});

describe("SupabaseAuthService.signInWithPassword", () => {
  it("signs in and returns the profile", async () => {
    const { client, service } = fakeClient();
    expect(await service.signInWithPassword("ama@example.test", "pw")).toEqual(ACCOUNT);
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "ama@example.test",
      password: "pw",
    });
  });

  it.each<[unknown, AuthErrorCode]>([
    [new AuthApiError("Invalid login credentials", 400, "invalid_credentials"), "invalid_credentials"],
    [new AuthApiError("User is banned", 400, "user_banned"), "inactive"],
    [new AuthApiError("Too many", 429, "over_request_rate_limit"), "rate_limited"],
    [new AuthApiError("Too many emails", 429, "over_email_send_rate_limit"), "rate_limited"],
    [new AuthApiError("Slow down", 429, undefined), "rate_limited"],
    [new AuthApiError("Same", 422, "same_password"), "same_password"],
    [new AuthApiError("Weak", 422, "weak_password"), "weak_password"],
    [new AuthWeakPasswordError("Weak", 422, ["length"]), "weak_password"],
    [new AuthApiError("Gone", 403, "session_not_found"), "session_missing"],
    [new AuthApiError("Expired", 403, "session_expired"), "session_missing"],
    [new AuthSessionMissingError(), "session_missing"],
    [new AuthRetryableFetchError("Failed to fetch", 0), "unavailable"],
    [new AuthApiError("Odd", 500, "unexpected_failure"), "unavailable"],
    [new Error("strange"), "unavailable"],
  ])("maps %s to %s", async (error, code) => {
    const { client, service } = fakeClient();
    client.auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error });
    await expectCode(service.signInWithPassword("a@b.test", "pw"), code);
  });

  it("maps a thrown (not returned) error too", async () => {
    const { client, service } = fakeClient();
    client.auth.signInWithPassword.mockRejectedValue(new TypeError("Failed to fetch"));
    await expectCode(service.signInWithPassword("a@b.test", "pw"), "unavailable");
  });
});

describe("SupabaseAuthService other actions", () => {
  it("signs out this device only, so other devices stay signed in", async () => {
    const { client, service } = fakeClient();
    await service.signOut();
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("treats sign-out as done even if the server could not be told (the device session is gone)", async () => {
    const { client, service } = fakeClient();
    client.auth.signOut.mockResolvedValue({ error: new AuthRetryableFetchError("x", 0) });
    await expect(service.signOut()).resolves.toBeUndefined();
  });

  it("records a login through the record_login function (AUD-03)", async () => {
    const { client, service } = fakeClient();
    await service.recordLogin("password");
    expect(client.rpc).toHaveBeenCalledWith("record_login", { login_method: "password" });
  });

  it("maps record_login refusals", async () => {
    const { client, service } = fakeClient();
    client.rpc.mockResolvedValue({ data: null, error: { message: "NO_ACTIVE_ACCOUNT" } });
    await expectCode(service.recordLogin("password"), "inactive");
    client.rpc.mockResolvedValue({ data: null, error: { message: "Failed to fetch" } });
    await expectCode(service.recordLogin("password"), "unavailable");
  });

  it("asks Supabase to email a reset link that opens the given page (AUTH-06)", async () => {
    const { client, service } = fakeClient();
    await service.requestPasswordReset("ama@example.test", "https://app.test/reset-password");
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith("ama@example.test", {
      redirectTo: "https://app.test/reset-password",
    });
    client.auth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: new AuthApiError("Too many", 429, "over_email_send_rate_limit"),
    });
    await expectCode(service.requestPasswordReset("ama@example.test", "x"), "rate_limited");
  });

  it("updates the password of the signed-in user", async () => {
    const { client, service } = fakeClient();
    await service.updatePassword("new-pass");
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: "new-pass" });
    client.auth.updateUser.mockResolvedValue({
      data: null,
      error: new AuthApiError("Same", 422, "same_password"),
    });
    await expectCode(service.updatePassword("new-pass"), "same_password");
  });

  it("reports only SIGNED_OUT events to session listeners, and can stop listening", () => {
    const { service, emit, unsubscribe } = fakeClient();
    const listener = vi.fn();
    const stop = service.onSessionEnded(listener);
    emit("TOKEN_REFRESHED");
    emit("SIGNED_IN");
    expect(listener).not.toHaveBeenCalled();
    emit("SIGNED_OUT");
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
