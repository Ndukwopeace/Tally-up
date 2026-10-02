// @vitest-environment node
/**
 * Tests for the admin user handlers (the logic behind /api/admin/users*).
 *
 * Rules under test: AUTH-02 / USR-01 (only an admin creates accounts), USR-02
 * (email, phones, role, depot), Q-57a / Q-57b (the admin types a temporary
 * password), Q-57g (email and role can change), SEC-1 (the caller is checked
 * before anything is touched), SEC-4 (no secrets in answers).
 * The backend (Supabase Auth and the database) is replaced by a fake that
 * records every call, so the tests prove what was and was not done.
 */
import { describe, expect, it, vi } from "vitest";

import { createUser, resetPassword, updateUser, type AdminBackend } from "./adminUsers.js";

const ADMIN = "11111111-1111-4111-8111-111111111111";
const TARGET = "22222222-2222-4222-8222-222222222222";
const DEPOT = "33333333-3333-4333-8333-333333333333";

// A backend where everything works; tests override the one call they want to break.
function fakeBackend(overrides: Partial<AdminBackend> = {}): AdminBackend {
  return {
    getUserId: vi.fn().mockResolvedValue(ADMIN),
    isActiveAdmin: vi.fn().mockResolvedValue(true),
    getProfileEmail: vi.fn().mockResolvedValue("old@example.test"),
    createAuthUser: vi.fn().mockResolvedValue({ id: TARGET }),
    setAuthEmail: vi.fn().mockResolvedValue(null),
    setAuthPassword: vi.fn().mockResolvedValue(null),
    deleteAuthUser: vi.fn().mockResolvedValue(undefined),
    saveUser: vi.fn().mockResolvedValue(null),
    recordPasswordReset: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

const NEW_USER = {
  fullName: " Ann Distributor ",
  email: " Ann@Example.test ",
  phones: ["+237677123456"],
  role: "distributor",
  active: true,
  depotId: null,
  password: "temp-pass-1",
};
const EDIT_USER = { ...NEW_USER, password: undefined };

function post(body: unknown, headers: Record<string, string> = { authorization: "Bearer good-token" }) {
  return new Request("https://tally.test/api/admin/users", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function answer(response: Response) {
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe("who may call (SEC-1)", () => {
  it("refuses a request without a login token and touches nothing", async () => {
    const backend = fakeBackend();
    const result = await answer(await createUser(post(NEW_USER, {}), backend));
    expect(result).toEqual({ status: 401, body: { error: "unauthenticated" } });
    expect(backend.createAuthUser).not.toHaveBeenCalled();
  });

  it("refuses a token that is not a Bearer token", async () => {
    const backend = fakeBackend();
    const result = await answer(await createUser(post(NEW_USER, { authorization: "Basic abc" }), backend));
    expect(result.status).toBe(401);
  });

  it("refuses a token Supabase does not accept", async () => {
    const backend = fakeBackend({ getUserId: vi.fn().mockResolvedValue(null) });
    const result = await answer(await createUser(post(NEW_USER), backend));
    expect(result).toEqual({ status: 401, body: { error: "unauthenticated" } });
    expect(backend.createAuthUser).not.toHaveBeenCalled();
  });

  it("refuses a signed-in user who is not an active admin before creating anything", async () => {
    const backend = fakeBackend({ isActiveAdmin: vi.fn().mockResolvedValue(false) });
    const result = await answer(await createUser(post(NEW_USER), backend));
    expect(result).toEqual({ status: 403, body: { error: "not_admin" } });
    expect(backend.createAuthUser).not.toHaveBeenCalled();
  });

  it("refuses a non-admin before changing a password or an email", async () => {
    const backend = fakeBackend({ isActiveAdmin: vi.fn().mockResolvedValue(false) });
    const reset = await resetPassword(post({ password: "new-temp-1" }), TARGET, backend);
    const edit = await updateUser(post(EDIT_USER), TARGET, backend);
    expect([reset.status, edit.status]).toEqual([403, 403]);
    expect(backend.setAuthPassword).not.toHaveBeenCalled();
    expect(backend.setAuthEmail).not.toHaveBeenCalled();
  });
});

describe("USR-01 create an account", () => {
  it("creates the login with a trimmed, lower-cased email, then the profile", async () => {
    const backend = fakeBackend();
    const result = await answer(await createUser(post(NEW_USER), backend));
    expect(result).toEqual({ status: 201, body: { id: TARGET } });
    expect(backend.createAuthUser).toHaveBeenCalledWith("ann@example.test", "temp-pass-1");
    expect(backend.saveUser).toHaveBeenCalledWith({
      actingAdmin: ADMIN,
      target: TARGET,
      fullName: "Ann Distributor",
      email: "ann@example.test",
      phones: ["+237677123456"],
      role: "distributor",
      status: "active",
      depotId: null,
      isNew: true,
    });
  });

  it("saves an inactive account when Active is off", async () => {
    const backend = fakeBackend();
    await createUser(post({ ...NEW_USER, active: false }), backend);
    expect(backend.saveUser).toHaveBeenCalledWith(expect.objectContaining({ status: "inactive" }));
  });

  it("passes the depot of a depot manager", async () => {
    const backend = fakeBackend();
    await createUser(post({ ...NEW_USER, role: "depot_manager", depotId: DEPOT }), backend);
    expect(backend.saveUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: "depot_manager", depotId: DEPOT }),
    );
  });

  it.each([
    ["no body", ""],
    ["not JSON", "{nope"],
    ["a name that is blank", { ...NEW_USER, fullName: "  " }],
    ["a missing password", { ...NEW_USER, password: undefined }],
    ["an empty password", { ...NEW_USER, password: "" }],
    ["an unknown role", { ...NEW_USER, role: "owner" }],
    ["a phone list that is not a list", { ...NEW_USER, phones: "+237677123456" }],
    ["a depot id that is not an id", { ...NEW_USER, depotId: "akwa" }],
  ])("refuses %s with 'invalid' and creates nothing", async (_label, body) => {
    const backend = fakeBackend();
    const result = await answer(await createUser(post(body), backend));
    expect(result).toEqual({ status: 400, body: { error: "invalid" } });
    expect(backend.createAuthUser).not.toHaveBeenCalled();
  });

  it("says the email is taken when Supabase Auth already has it", async () => {
    const backend = fakeBackend({ createAuthUser: vi.fn().mockResolvedValue({ error: "email_taken" }) });
    const result = await answer(await createUser(post(NEW_USER), backend));
    expect(result).toEqual({ status: 409, body: { error: "email_taken" } });
    expect(backend.saveUser).not.toHaveBeenCalled();
  });

  it("passes on a password Supabase refuses as too weak", async () => {
    const backend = fakeBackend({ createAuthUser: vi.fn().mockResolvedValue({ error: "weak_password" }) });
    const result = await answer(await createUser(post(NEW_USER), backend));
    expect(result).toEqual({ status: 422, body: { error: "weak_password" } });
  });

  it("removes the login again when the database refuses the profile, so no half-account is left", async () => {
    const backend = fakeBackend({ saveUser: vi.fn().mockResolvedValue("depot_required") });
    const result = await answer(await createUser(post(NEW_USER), backend));
    expect(result).toEqual({ status: 400, body: { error: "depot_required" } });
    expect(backend.deleteAuthUser).toHaveBeenCalledWith(TARGET);
  });

  it("never puts the password in an answer", async () => {
    const backend = fakeBackend();
    const response = await createUser(post(NEW_USER), backend);
    expect(await response.text()).not.toContain("temp-pass-1");
  });
});

describe("USR-02 / Q-57g edit an account", () => {
  it("saves the profile and leaves the login alone when the email is unchanged", async () => {
    const backend = fakeBackend({ getProfileEmail: vi.fn().mockResolvedValue("ann@example.test") });
    const result = await answer(await updateUser(post(EDIT_USER), TARGET, backend));
    expect(result).toEqual({ status: 200, body: { id: TARGET } });
    expect(backend.setAuthEmail).not.toHaveBeenCalled();
    expect(backend.saveUser).toHaveBeenCalledWith(expect.objectContaining({ target: TARGET, isNew: false }));
  });

  it("changes the login email first when the email changed", async () => {
    const backend = fakeBackend();
    await updateUser(post(EDIT_USER), TARGET, backend);
    expect(backend.setAuthEmail).toHaveBeenCalledWith(TARGET, "ann@example.test");
    expect(backend.saveUser).toHaveBeenCalled();
  });

  it("refuses a new email that another login already uses, and saves nothing", async () => {
    const backend = fakeBackend({ setAuthEmail: vi.fn().mockResolvedValue("email_taken") });
    const result = await answer(await updateUser(post(EDIT_USER), TARGET, backend));
    expect(result).toEqual({ status: 409, body: { error: "email_taken" } });
    expect(backend.saveUser).not.toHaveBeenCalled();
  });

  it("puts the old login email back when the database refuses the change", async () => {
    const backend = fakeBackend({ saveUser: vi.fn().mockResolvedValue("last_admin") });
    const result = await answer(await updateUser(post(EDIT_USER), TARGET, backend));
    expect(result).toEqual({ status: 409, body: { error: "last_admin" } });
    expect(backend.setAuthEmail).toHaveBeenLastCalledWith(TARGET, "old@example.test");
  });

  it("does not touch the login email when only the profile was refused", async () => {
    const backend = fakeBackend({
      getProfileEmail: vi.fn().mockResolvedValue("ann@example.test"),
      saveUser: vi.fn().mockResolvedValue("cannot_deactivate_self"),
    });
    const result = await answer(await updateUser(post(EDIT_USER), TARGET, backend));
    expect(result).toEqual({ status: 409, body: { error: "cannot_deactivate_self" } });
    expect(backend.setAuthEmail).not.toHaveBeenCalled();
  });

  it("says not found for an account that does not exist", async () => {
    const backend = fakeBackend({ getProfileEmail: vi.fn().mockResolvedValue(null) });
    const result = await answer(await updateUser(post(EDIT_USER), TARGET, backend));
    expect(result).toEqual({ status: 404, body: { error: "not_found" } });
  });

  it("refuses an id that is not an id", async () => {
    const backend = fakeBackend();
    const result = await answer(await updateUser(post(EDIT_USER), "not-an-id", backend));
    expect(result).toEqual({ status: 400, body: { error: "invalid" } });
  });

  it("refuses a body with a password: passwords are reset on their own route", async () => {
    const backend = fakeBackend();
    const result = await answer(
      await updateUser(post({ ...EDIT_USER, password: "sneaky-1" }), TARGET, backend),
    );
    expect(result.status).toBe(400);
    expect(backend.saveUser).not.toHaveBeenCalled();
  });
});

describe("USR-04 / Q-57b reset a password", () => {
  it("sets the new temporary password and logs it", async () => {
    const backend = fakeBackend();
    const result = await answer(await resetPassword(post({ password: "new-temp-1" }), TARGET, backend));
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(backend.setAuthPassword).toHaveBeenCalledWith(TARGET, "new-temp-1");
    expect(backend.recordPasswordReset).toHaveBeenCalledWith(ADMIN, TARGET);
  });

  it.each([
    ["a missing password", {}],
    ["an empty password", { password: "" }],
    ["a password that is not text", { password: 12345 }],
  ])("refuses %s", async (_label, body) => {
    const backend = fakeBackend();
    const result = await answer(await resetPassword(post(body), TARGET, backend));
    expect(result).toEqual({ status: 400, body: { error: "invalid" } });
    expect(backend.setAuthPassword).not.toHaveBeenCalled();
  });

  it("says not found for an unknown account", async () => {
    const backend = fakeBackend({ setAuthPassword: vi.fn().mockResolvedValue("not_found") });
    const result = await answer(await resetPassword(post({ password: "new-temp-1" }), TARGET, backend));
    expect(result).toEqual({ status: 404, body: { error: "not_found" } });
    expect(backend.recordPasswordReset).not.toHaveBeenCalled();
  });

  it("passes on a weak password and logs nothing", async () => {
    const backend = fakeBackend({ setAuthPassword: vi.fn().mockResolvedValue("weak_password") });
    const result = await answer(await resetPassword(post({ password: "123" }), TARGET, backend));
    expect(result).toEqual({ status: 422, body: { error: "weak_password" } });
    expect(backend.recordPasswordReset).not.toHaveBeenCalled();
  });

  it("reports a failure to write the log, so the admin knows to try again", async () => {
    const backend = fakeBackend({ recordPasswordReset: vi.fn().mockResolvedValue("unavailable") });
    const result = await answer(await resetPassword(post({ password: "new-temp-1" }), TARGET, backend));
    expect(result).toEqual({ status: 500, body: { error: "unavailable" } });
  });
});

describe("a backend that is down", () => {
  it("answers 'unavailable' when the token check throws", async () => {
    const backend = fakeBackend({ getUserId: vi.fn().mockRejectedValue(new Error("network")) });
    const result = await answer(await createUser(post(NEW_USER), backend));
    expect(result).toEqual({ status: 500, body: { error: "unavailable" } });
  });
});
