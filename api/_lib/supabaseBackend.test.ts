// @vitest-environment node
/**
 * Tests for the Supabase-backed AdminBackend (the client is faked; no network).
 *
 * Rules under test: SEC-4 (the key is read on the server only, and a server
 * without settings says "unavailable"), USR-01 / USR-04 (the right Supabase
 * calls are made), and that Supabase's and the database's raw errors become
 * the short codes the app understands.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { accountIdFromPath, withBackend } from "./route.js";
import { backendFromEnv, createSupabaseBackend } from "./supabaseBackend.js";

// A client whose profile query ends in `maybeSingle`, and whose auth and rpc calls are spies.
function fakeClient(options: { row?: unknown; rowError?: boolean } = {}) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue(
      options.rowError
        ? { data: null, error: { message: "boom" } }
        : { data: options.row ?? null, error: null },
    );
  const eq = vi.fn();
  const chain = { eq, maybeSingle };
  eq.mockReturnValue(chain);
  const admin = {
    createUser: vi.fn().mockResolvedValue({ data: { user: { id: "new-id" } }, error: null }),
    updateUserById: vi.fn().mockResolvedValue({ error: null }),
    deleteUser: vi.fn().mockResolvedValue({ error: null }),
  };
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-id" } }, error: null }), admin },
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(chain) }),
    rpc: vi.fn().mockResolvedValue({ error: null }),
  };
  return { client, admin, eq };
}

function backendWith(fake: ReturnType<typeof fakeClient>) {
  return createSupabaseBackend(fake.client as unknown as SupabaseClient);
}

const SAVE = {
  actingAdmin: "admin-id",
  target: "t1",
  fullName: "Ann",
  email: "ann@example.test",
  phones: ["+237677123456"],
  role: "distributor" as const,
  status: "active" as const,
  depotId: null,
  isNew: true,
};

describe("who is asking", () => {
  it("returns the login id Supabase gives for a token", async () => {
    const fake = fakeClient();
    expect(await backendWith(fake).getUserId("tok")).toBe("admin-id");
    expect(fake.client.auth.getUser).toHaveBeenCalledWith("tok");
  });

  it("returns null when Supabase does not accept the token", async () => {
    const fake = fakeClient();
    fake.client.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "bad" } });
    expect(await backendWith(fake).getUserId("tok")).toBeNull();
  });

  it("finds an active admin by id, role and status", async () => {
    const fake = fakeClient({ row: { id: "admin-id" } });
    expect(await backendWith(fake).isActiveAdmin("admin-id")).toBe(true);
    expect(fake.eq).toHaveBeenCalledWith("role", "admin");
    expect(fake.eq).toHaveBeenCalledWith("status", "active");
  });

  it("says no when there is no such admin", async () => {
    expect(await backendWith(fakeClient()).isActiveAdmin("x")).toBe(false);
  });

  it("fails loudly when the profile lookup fails, so a failed lookup is never read as 'not an admin' or 'allowed'", async () => {
    await expect(backendWith(fakeClient({ rowError: true })).isActiveAdmin("x")).rejects.toThrow();
    await expect(backendWith(fakeClient({ rowError: true })).getProfileEmail("x")).rejects.toThrow();
  });

  it("reads a profile's email, or null when there is none", async () => {
    expect(await backendWith(fakeClient({ row: { email: "a@x.test" } })).getProfileEmail("x")).toBe(
      "a@x.test",
    );
    expect(await backendWith(fakeClient()).getProfileEmail("x")).toBeNull();
  });
});

describe("Supabase Auth calls", () => {
  it("creates a confirmed login with the temporary password (Q-57a)", async () => {
    const fake = fakeClient();
    expect(await backendWith(fake).createAuthUser("ann@example.test", "pw")).toEqual({ id: "new-id" });
    expect(fake.admin.createUser).toHaveBeenCalledWith({
      email: "ann@example.test",
      password: "pw",
      email_confirm: true,
    });
  });

  it.each([
    ["email_exists", "email_taken"],
    ["user_already_exists", "email_taken"],
    ["weak_password", "weak_password"],
    ["email_address_invalid", "invalid"],
    ["something_else", "unavailable"],
  ])("turns the Supabase code %s into %s when creating", async (code, expected) => {
    const fake = fakeClient();
    fake.admin.createUser.mockResolvedValueOnce({ data: { user: null }, error: { code } });
    expect(await backendWith(fake).createAuthUser("a@x.test", "pw")).toEqual({ error: expected });
  });

  it("changes a login's email and keeps it confirmed", async () => {
    const fake = fakeClient();
    expect(await backendWith(fake).setAuthEmail("t1", "new@x.test")).toBeNull();
    expect(fake.admin.updateUserById).toHaveBeenCalledWith("t1", {
      email: "new@x.test",
      email_confirm: true,
    });
  });

  it("maps a refused email change and a refused password change to codes", async () => {
    const fake = fakeClient();
    fake.admin.updateUserById.mockResolvedValueOnce({ error: { code: "email_exists" } });
    expect(await backendWith(fake).setAuthEmail("t1", "a@x.test")).toBe("email_taken");
    fake.admin.updateUserById.mockResolvedValueOnce({ error: { code: "user_not_found" } });
    expect(await backendWith(fake).setAuthPassword("t1", "pw")).toBe("not_found");
    fake.admin.updateUserById.mockResolvedValueOnce({ error: {} });
    expect(await backendWith(fake).setAuthPassword("t1", "pw")).toBe("unavailable");
  });

  it("sets a password", async () => {
    const fake = fakeClient();
    expect(await backendWith(fake).setAuthPassword("t1", "pw")).toBeNull();
    expect(fake.admin.updateUserById).toHaveBeenCalledWith("t1", { password: "pw" });
  });

  it("deletes a login", async () => {
    const fake = fakeClient();
    await backendWith(fake).deleteAuthUser("t1");
    expect(fake.admin.deleteUser).toHaveBeenCalledWith("t1");
  });
});

describe("database functions", () => {
  it("calls admin_save_user with the acting admin and every value", async () => {
    const fake = fakeClient();
    expect(await backendWith(fake).saveUser(SAVE)).toBeNull();
    expect(fake.client.rpc).toHaveBeenCalledWith("admin_save_user", {
      acting_admin: "admin-id",
      target: "t1",
      user_name: "Ann",
      user_email: "ann@example.test",
      user_phones: ["+237677123456"],
      user_role: "distributor",
      user_status: "active",
      user_depot: null,
      is_new: true,
    });
  });

  it.each([
    ["NOT_ADMIN", "not_admin"],
    ["NOT_FOUND", "not_found"],
    ["INVALID_USER", "invalid"],
    ["DEPOT_REQUIRED", "depot_required"],
    ["CANNOT_DEACTIVATE_SELF", "cannot_deactivate_self"],
    ["LAST_ADMIN", "last_admin"],
    ["EMAIL_TAKEN", "email_taken"],
    ['relation "x" does not exist', "unavailable"],
  ])("turns the database message %s into %s", async (message, expected) => {
    const fake = fakeClient();
    fake.client.rpc.mockResolvedValueOnce({ error: { message } });
    expect(await backendWith(fake).saveUser(SAVE)).toBe(expected);
  });

  it("logs a password reset, and maps its refusals", async () => {
    const fake = fakeClient();
    expect(await backendWith(fake).recordPasswordReset("admin-id", "t1")).toBeNull();
    expect(fake.client.rpc).toHaveBeenCalledWith("admin_record_password_reset", {
      acting_admin: "admin-id",
      target: "t1",
    });
    fake.client.rpc.mockResolvedValueOnce({ error: { message: "NOT_FOUND" } });
    expect(await backendWith(fake).recordPasswordReset("admin-id", "t1")).toBe("not_found");
  });
});

describe("SEC-4 the server's settings", () => {
  it("has no backend without the URL or without the service key", () => {
    expect(backendFromEnv({})).toBeNull();
    expect(backendFromEnv({ SUPABASE_URL: "https://p.supabase.co" })).toBeNull();
    expect(backendFromEnv({ SUPABASE_SERVICE_ROLE_KEY: "key" })).toBeNull();
    expect(backendFromEnv({ SUPABASE_URL: "  ", SUPABASE_SERVICE_ROLE_KEY: "key" })).toBeNull();
  });

  it("builds a backend from the names the Vercel integration creates", () => {
    expect(
      backendFromEnv({ SUPABASE_URL: "https://p.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "key" }),
    ).not.toBeNull();
    expect(
      backendFromEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://p.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "key" }),
    ).not.toBeNull();
    expect(
      backendFromEnv({ VITE_SUPABASE_URL: "https://p.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "key" }),
    ).not.toBeNull();
  });

  it("answers 'unavailable' without a settings, instead of running the handler", async () => {
    const handler = vi.fn();
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const response = await withBackend(handler);
    vi.unstubAllEnvs();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "unavailable" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs the handler when the server is set up", async () => {
    vi.stubEnv("SUPABASE_URL", "https://p.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "key");
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const response = await withBackend(handler);
    vi.unstubAllEnvs();
    expect(handler).toHaveBeenCalledOnce();
    expect(await response.text()).toBe("ok");
  });
});

describe("the account id in the address", () => {
  it("is the fourth part of /api/admin/users/<id>", () => {
    expect(accountIdFromPath(new Request("https://t.test/api/admin/users/abc"))).toBe("abc");
    expect(accountIdFromPath(new Request("https://t.test/api/admin/users/abc/reset-password"))).toBe("abc");
  });

  it("is empty when the address has none", () => {
    expect(accountIdFromPath(new Request("https://t.test/api/admin/users"))).toBe("");
  });
});
