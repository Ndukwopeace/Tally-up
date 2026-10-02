/**
 * Tests for the sign-in state of the app.
 *
 * Rules under test:
 *  - AUTH-03 / AUTH-07: password sign-in; the account decides the portal.
 *  - AUTH-04 / AUTH-09: unknown or inactive accounts are refused and signed out.
 *  - Q-55: roles whose portal is not open are refused and signed out.
 *  - AUD-03: each accepted login is recorded; if recording fails, no login.
 *  - ARCHITECTURE §4.5: a session for a refused account is ended at start-up.
 */
import { MOCK_PASSWORD } from "../../tests/helpers/mockPassword";
import { describe, expect, it, vi } from "vitest";

import { AuthStore } from "./AuthStore";

import { MOCK_USERS, MockAuthService } from "@/services/mock/MockAuthService";

const { admin, inactiveAdmin, distributor } = MOCK_USERS;

async function started(
  service = new MockAuthService({ password: MOCK_PASSWORD }),
  openPortals?: readonly ("admin" | "distributor")[],
) {
  const store = new AuthStore(service, openPortals);
  await store.start();
  return { store, service };
}

describe("AuthStore start-up", () => {
  it("is loading until the session has been checked", () => {
    expect(new AuthStore(new MockAuthService({ password: MOCK_PASSWORD })).getState()).toEqual({
      status: "loading",
    });
  });

  it("is signed out with no session", async () => {
    const { store } = await started();
    expect(store.getState()).toEqual({ status: "signed_out", notice: null });
  });

  it("restores an admin's session", async () => {
    const { store } = await started(new MockAuthService({ password: MOCK_PASSWORD, signedInAs: admin.id }));
    expect(store.getState()).toEqual({ status: "signed_in", account: admin });
  });

  it("AUTH-09: ends an inactive account's session and says why", async () => {
    const { store, service } = await started(
      new MockAuthService({ password: MOCK_PASSWORD, signedInAs: inactiveAdmin.id }),
    );
    expect(store.getState()).toEqual({ status: "signed_out", notice: "inactive" });
    expect(await service.getAccount()).toBeNull();
  });

  it("Q-55: ends the session of a role whose portal is not open", async () => {
    const { store } = await started(
      new MockAuthService({ password: MOCK_PASSWORD, signedInAs: distributor.id }),
    );
    expect(store.getState()).toEqual({ status: "signed_out", notice: "portal_not_open" });
  });

  it("AUTH-04: ends a session that has no Tally-Up account", async () => {
    const { store } = await started(
      new MockAuthService({ password: MOCK_PASSWORD, signedInAs: "mock-orphan" }),
    );
    expect(store.getState()).toEqual({ status: "signed_out", notice: "no_account" });
  });

  it("shows an error, not the login page, when the check itself fails; retry recovers", async () => {
    const service = new MockAuthService({ password: MOCK_PASSWORD, signedInAs: admin.id });
    service.failNextCallWith("unavailable");
    const { store } = await started(service);
    expect(store.getState()).toEqual({ status: "error" });
    await store.start();
    expect(store.getState()).toEqual({ status: "signed_in", account: admin });
  });

  it("notifies subscribers on every change, until they unsubscribe", async () => {
    const store = new AuthStore(new MockAuthService({ password: MOCK_PASSWORD }));
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    await store.start();
    expect(listener).toHaveBeenCalled();
    stop();
    listener.mockClear();
    await store.signIn(admin.email, MOCK_PASSWORD);
    expect(listener).not.toHaveBeenCalled();
  });

  it("signs out when the session ends elsewhere (expired, other tab)", async () => {
    const { store, service } = await started(
      new MockAuthService({ password: MOCK_PASSWORD, signedInAs: admin.id }),
    );
    service.endSessionElsewhere();
    expect(store.getState()).toEqual({ status: "signed_out", notice: null });
  });

  it("stops listening to the service when disposed", async () => {
    const { store, service } = await started(
      new MockAuthService({ password: MOCK_PASSWORD, signedInAs: admin.id }),
    );
    store.dispose();
    service.endSessionElsewhere();
    expect(store.getState().status).toBe("signed_in");
  });
});

describe("AuthStore.signIn", () => {
  it("signs an admin in and records the login (AUD-03)", async () => {
    const { store, service } = await started();
    expect(await store.signIn(" admin@tallyup.test ", MOCK_PASSWORD)).toBeNull();
    expect(store.getState()).toEqual({ status: "signed_in", account: admin });
    expect(service.logins).toEqual([{ accountId: admin.id, method: "password" }]);
  });

  it("returns the error code for a wrong password and stays signed out", async () => {
    const { store } = await started();
    expect(await store.signIn(admin.email, "nope")).toBe("invalid_credentials");
    expect(store.getState().status).toBe("signed_out");
  });

  it.each([
    [inactiveAdmin.email, "inactive"],
    [distributor.email, "portal_not_open"],
    ["orphan@tallyup.test", "no_account"],
  ])("refuses %s (%s), signs it out and records no login", async (email, code) => {
    const { store, service } = await started();
    expect(await store.signIn(email, MOCK_PASSWORD)).toBe(code);
    expect(await service.getAccount()).toBeNull();
    expect(service.logins).toEqual([]);
  });

  it("opens other portals when they are listed as open", async () => {
    const { store } = await started(new MockAuthService({ password: MOCK_PASSWORD }), [
      "admin",
      "distributor",
    ]);
    expect(await store.signIn(distributor.email, MOCK_PASSWORD)).toBeNull();
  });

  it("AUD-03: if the login cannot be recorded, the user is not signed in", async () => {
    const { store, service } = await started();
    const signIn = store.signIn(admin.email, MOCK_PASSWORD);
    service.failNextCallWith("unavailable"); // fails recordLogin, the call after sign-in
    expect(await signIn).toBe("unavailable");
    expect(store.getState().status).toBe("signed_out");
    expect(await service.getAccount()).toBeNull();
  });
});

describe("AuthStore other actions", () => {
  it("signs out", async () => {
    const { store, service } = await started(
      new MockAuthService({ password: MOCK_PASSWORD, signedInAs: admin.id }),
    );
    await store.signOut();
    expect(store.getState()).toEqual({ status: "signed_out", notice: null });
    expect(await service.getAccount()).toBeNull();
  });

  it("is signed out locally even if the backend call fails", async () => {
    const service = new MockAuthService({ password: MOCK_PASSWORD, signedInAs: admin.id });
    const { store } = await started(service);
    service.failNextCallWith("unavailable");
    await store.signOut();
    expect(store.getState().status).toBe("signed_out");
  });

  it("requests a reset email and reports failures as codes", async () => {
    const { store, service } = await started();
    expect(await store.requestPasswordReset("a@b.test", "https://x/reset-password")).toBeNull();
    expect(service.resetRequests).toHaveLength(1);
    service.failNextCallWith("rate_limited");
    expect(await store.requestPasswordReset("a@b.test", "https://x/reset-password")).toBe("rate_limited");
  });

  it("changes the password when signed in, and refuses otherwise", async () => {
    const { store } = await started();
    expect(await store.updatePassword("new-pass-1")).toBe("session_missing");
    await store.signIn(admin.email, MOCK_PASSWORD);
    expect(await store.updatePassword(MOCK_PASSWORD)).toBe("same_password");
    expect(await store.updatePassword("new-pass-1")).toBeNull();
  });
});
