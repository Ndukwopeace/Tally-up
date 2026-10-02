/**
 * Tests for the mock auth backend (tests and offline local development only).
 *
 * Rules under test (ARCHITECTURE §5.3, §7): the mock behaves like Supabase for
 * every AuthService method, so tests written against it hold for the real one.
 */
import { describe, expect, it, vi } from "vitest";

import { MOCK_PASSWORD, MOCK_USERS, MockAuthService } from "./MockAuthService";

import { AuthError } from "@/services/interfaces/AuthService";

const admin = MOCK_USERS.admin;

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toEqual(new AuthError(code as AuthError["code"]));
}

describe("MockAuthService", () => {
  it("starts signed out unless told otherwise", async () => {
    expect(await new MockAuthService().getAccount()).toBeNull();
    expect(await new MockAuthService({ signedInAs: admin.id }).getAccount()).toEqual(admin);
  });

  it("signs in with the right password, whatever the email's letter case", async () => {
    const service = new MockAuthService();
    expect(await service.signInWithPassword("ADMIN@tallyup.test", MOCK_PASSWORD)).toEqual(admin);
    expect(await service.getAccount()).toEqual(admin);
  });

  it("refuses a wrong password or unknown email the same way", async () => {
    const service = new MockAuthService();
    await expectCode(service.signInWithPassword(admin.email, "wrong"), "invalid_credentials");
    await expectCode(service.signInWithPassword("nobody@tallyup.test", MOCK_PASSWORD), "invalid_credentials");
  });

  it("returns inactive accounts too; the caller decides (AUTH-09)", async () => {
    const service = new MockAuthService();
    const account = await service.signInWithPassword(MOCK_USERS.inactiveAdmin.email, MOCK_PASSWORD);
    expect(account.status).toBe("inactive");
  });

  it("throws no_account for a login with no profile (AUTH-04)", async () => {
    const service = new MockAuthService();
    await expectCode(service.signInWithPassword("orphan@tallyup.test", MOCK_PASSWORD), "no_account");
  });

  it("signs out and tells session listeners only when the session ends elsewhere", async () => {
    const service = new MockAuthService({ signedInAs: admin.id });
    const listener = vi.fn();
    const stop = service.onSessionEnded(listener);
    await service.signOut();
    expect(await service.getAccount()).toBeNull();
    expect(listener).not.toHaveBeenCalled();

    await service.signInWithPassword(admin.email, MOCK_PASSWORD);
    service.endSessionElsewhere();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(await service.getAccount()).toBeNull();
    stop();
    service.endSessionElsewhere();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("records logins for the signed-in account only (AUD-03)", async () => {
    const service = new MockAuthService();
    await expectCode(service.recordLogin("password"), "session_missing");
    await service.signInWithPassword(admin.email, MOCK_PASSWORD);
    await service.recordLogin("password");
    expect(service.logins).toEqual([{ accountId: admin.id, method: "password" }]);
  });

  it("refuses to record a login for an inactive account (AUTH-09)", async () => {
    const service = new MockAuthService({ signedInAs: MOCK_USERS.inactiveAdmin.id });
    await expectCode(service.recordLogin("password"), "inactive");
  });

  it("accepts reset requests for any email without revealing which exist", async () => {
    const service = new MockAuthService();
    await service.requestPasswordReset("nobody@tallyup.test", "http://localhost/reset-password");
    expect(service.resetRequests).toEqual([
      { email: "nobody@tallyup.test", redirectTo: "http://localhost/reset-password" },
    ]);
  });

  it("changes the password of the signed-in account", async () => {
    const service = new MockAuthService();
    await expectCode(service.updatePassword("new-password-1"), "session_missing");
    await service.signInWithPassword(admin.email, MOCK_PASSWORD);
    await expectCode(service.updatePassword(MOCK_PASSWORD), "same_password");
    await service.updatePassword("new-password-1");
    await service.signOut();
    await expectCode(service.signInWithPassword(admin.email, MOCK_PASSWORD), "invalid_credentials");
    expect(await service.signInWithPassword(admin.email, "new-password-1")).toEqual(admin);
  });

  it("can fail the next call on purpose, to test error screens (ARCHITECTURE §7)", async () => {
    const service = new MockAuthService({ signedInAs: admin.id });
    service.failNextCallWith("unavailable");
    await expectCode(service.getAccount(), "unavailable");
    expect(await service.getAccount()).toEqual(admin);
  });

  it("can hold the next call until released, to test loading states", async () => {
    const service = new MockAuthService();
    const release = service.holdNextCall();
    let settled = false;
    const pending = service.signOut().then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    release();
    await pending;
    expect(settled).toBe(true);
  });

  it("keeps the session in the given storage, so a refresh stays signed in", async () => {
    const storage = new Map<string, string>();
    const store = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    };
    await new MockAuthService({ storage: store }).signInWithPassword(admin.email, MOCK_PASSWORD);
    expect(await new MockAuthService({ storage: store }).getAccount()).toEqual(admin);
    await new MockAuthService({ storage: store }).signOut();
    expect(await new MockAuthService({ storage: store }).getAccount()).toBeNull();
  });
});
