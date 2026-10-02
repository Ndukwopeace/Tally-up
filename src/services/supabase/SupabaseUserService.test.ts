/**
 * Tests for the Supabase UserService (the client and fetch are faked; no network).
 *
 * Rules under test: reads come from `profiles` with the depot they run; writes
 * go to the admin endpoints with the admin's token (SEC-4: no secret server key
 * in the browser); server refusals become plain codes; passwords are sent only
 * when creating (Q-57a) or resetting (Q-57b).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { SupabaseUserService } from "./SupabaseUserService";

import type { UserSaveInput } from "@/domain/users";
import { UserError } from "@/services/interfaces/UserService";

const ROW = {
  id: "u1",
  full_name: "Mia Manager",
  email: "mia@x.test",
  phones: ["+237677123456"],
  role: "depot_manager",
  status: "active",
  depots: { id: "d1", name: "Akwa" },
};
const USER = {
  id: "u1",
  fullName: "Mia Manager",
  email: "mia@x.test",
  phones: ["+237677123456"],
  role: "depot_manager",
  status: "active",
  depot: { id: "d1", name: "Akwa" },
};
const INPUT: UserSaveInput = {
  fullName: "Mia Manager",
  email: "mia@x.test",
  phones: ["+237677123456"],
  role: "depot_manager",
  status: "inactive",
  depotId: null,
};

function fakeClient(options: { token?: string | null; rows?: unknown; error?: boolean } = {}) {
  const result = options.error
    ? { data: null, error: { message: "x" } }
    : { data: options.rows ?? [ROW], error: null };
  const maybeSingle = vi
    .fn()
    .mockResolvedValue(
      options.error ? result : { data: options.rows === undefined ? ROW : options.rows, error: null },
    );
  const order = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ order, eq });
  const from = vi.fn().mockReturnValue({ select });
  const getSession = vi.fn().mockResolvedValue({
    data: { session: options.token === null ? null : { access_token: options.token ?? "admin-token" } },
  });
  return { client: { from, auth: { getSession } } as unknown as SupabaseClient, from, select, order, eq };
}

function jsonResponse(body: unknown) {
  return vi.fn().mockResolvedValue({ json: () => Promise.resolve(body) });
}

describe("reading", () => {
  it("lists accounts from profiles with the depot each manager runs, by name", async () => {
    const fake = fakeClient();
    expect(await new SupabaseUserService(fake.client).list()).toEqual([USER]);
    expect(fake.from).toHaveBeenCalledWith("profiles");
    expect(fake.select).toHaveBeenCalledWith(expect.stringContaining("depots (id, name)"));
    expect(fake.order).toHaveBeenCalledWith("full_name");
  });

  it("reads one account, or null when there is none", async () => {
    expect(await new SupabaseUserService(fakeClient().client).get("u1")).toEqual(USER);
    expect(await new SupabaseUserService(fakeClient({ rows: null }).client).get("x")).toBeNull();
  });

  it("an account with no depot has depot null", async () => {
    const fake = fakeClient({ rows: [{ ...ROW, depots: null, role: "admin" }] });
    expect((await new SupabaseUserService(fake.client).list())[0]?.depot).toBeNull();
  });

  it("says unavailable when the read fails or a row is not what was expected (SEC-5)", async () => {
    await expect(new SupabaseUserService(fakeClient({ error: true }).client).list()).rejects.toMatchObject({
      code: "unavailable",
    });
    await expect(new SupabaseUserService(fakeClient({ error: true }).client).get("u1")).rejects.toMatchObject(
      { code: "unavailable" },
    );
    await expect(
      new SupabaseUserService(fakeClient({ rows: [{ ...ROW, role: "owner" }] }).client).list(),
    ).rejects.toBeInstanceOf(UserError);
  });
});

describe("writing through the admin endpoints", () => {
  it("creates an account: POST with the admin's token, the values and the temporary password", async () => {
    const request = jsonResponse({ id: "new-id" });
    const id = await new SupabaseUserService(fakeClient().client, request).create(INPUT, "temp-1");
    expect(id).toBe("new-id");
    expect(request).toHaveBeenCalledWith("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer admin-token" },
      body: JSON.stringify({
        fullName: "Mia Manager",
        email: "mia@x.test",
        phones: ["+237677123456"],
        role: "depot_manager",
        active: false,
        depotId: null,
        password: "temp-1",
      }),
    });
  });

  it("edits an account: PATCH on its address, with no password", async () => {
    const request = jsonResponse({ id: "u1" });
    expect(await new SupabaseUserService(fakeClient().client, request).update("u1", INPUT)).toBe("u1");
    const [path, init] = request.mock.calls[0] as [string, { method: string; body: string }];
    expect(path).toBe("/api/admin/users/u1");
    expect(init.method).toBe("PATCH");
    expect(init.body).not.toContain("password");
  });

  it("resets a password: POST to its reset address", async () => {
    const request = jsonResponse({ ok: true });
    await new SupabaseUserService(fakeClient().client, request).resetPassword("u 1", "new-temp");
    const [path, init] = request.mock.calls[0] as [string, { body: string }];
    expect(path).toBe("/api/admin/users/u%201/reset-password");
    expect(init.body).toBe(JSON.stringify({ password: "new-temp" }));
  });

  it("does not call the server without a session", async () => {
    const request = jsonResponse({ id: "x" });
    const service = new SupabaseUserService(fakeClient({ token: null }).client, request);
    await expect(service.create(INPUT, "pw")).rejects.toMatchObject({ code: "unauthenticated" });
    expect(request).not.toHaveBeenCalled();
  });

  it.each(["email_taken", "last_admin", "weak_password", "not_admin", "depot_required"])(
    "turns the server's %s into the same code",
    async (code) => {
      const service = new SupabaseUserService(fakeClient().client, jsonResponse({ error: code }));
      await expect(service.update("u1", INPUT)).rejects.toMatchObject({ code });
    },
  );

  it("says unavailable for a code it does not know, an answer that is not JSON, or no network", async () => {
    const unknown = new SupabaseUserService(fakeClient().client, jsonResponse({ error: "teapot" }));
    await expect(unknown.update("u1", INPUT)).rejects.toMatchObject({ code: "unavailable" });
    const notJson = vi.fn().mockResolvedValue({ json: () => Promise.reject(new Error("not json")) });
    await expect(
      new SupabaseUserService(fakeClient().client, notJson).update("u1", INPUT),
    ).rejects.toMatchObject({ code: "unavailable" });
    const offline = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(
      new SupabaseUserService(fakeClient().client, offline).update("u1", INPUT),
    ).rejects.toMatchObject({ code: "unavailable" });
  });

  it("returns an empty id when the answer has none (a reset)", async () => {
    const request = jsonResponse({});
    await expect(
      new SupabaseUserService(fakeClient().client, request).resetPassword("u1", "pw"),
    ).resolves.toBeUndefined();
  });
});
