/**
 * Tests for the Supabase DepotService (the Supabase client is faked; no network).
 *
 * Rules under test: the depot's manager is its active depot-manager account
 * (DEP-03); saves go through admin_save_depot; refusals become plain codes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { SupabaseDepotService } from "./SupabaseDepotService";

import { DepotError } from "@/services/interfaces/DepotService";

const ROW = {
  id: "d1",
  name: "Akwa",
  location: "Douala",
  address: "Market",
  phones: ["+237677123456"],
  status: "active",
  profiles: [
    { id: "old", full_name: "Old Manager", role: "depot_manager", status: "inactive" },
    { id: "m1", full_name: "Mia Manager", role: "depot_manager", status: "active" },
  ],
};
const DEPOT = {
  id: "d1",
  name: "Akwa",
  location: "Douala",
  address: "Market",
  phones: ["+237677123456"],
  status: "active",
  manager: { id: "m1", fullName: "Mia Manager" },
};
const MANAGER_ROW = {
  id: "m1",
  full_name: "Mia Manager",
  email: "mia@x.test",
  status: "active",
  depot_id: "d1",
};
const INPUT = {
  name: "Akwa",
  location: "Douala",
  address: "Market",
  phones: [],
  status: "active" as const,
  managerId: "m1",
};

function fakeClient() {
  const maybeSingle = vi.fn().mockResolvedValue({ data: ROW, error: null });
  const order = vi.fn().mockResolvedValue({ data: [ROW], error: null });
  const managersOrder = vi.fn().mockResolvedValue({ data: [MANAGER_ROW], error: null });
  const roleEq = vi.fn().mockReturnValue({ order: managersOrder });
  const idEq = vi.fn().mockReturnValue({ maybeSingle });
  const from = vi.fn((table: string) =>
    table === "depots"
      ? { select: vi.fn().mockReturnValue({ order, eq: idEq }) }
      : { select: vi.fn().mockReturnValue({ eq: roleEq }) },
  );
  const client = { from, rpc: vi.fn().mockResolvedValue({ data: "d9", error: null }) };
  return {
    client,
    order,
    maybeSingle,
    managersOrder,
    roleEq,
    service: new SupabaseDepotService(client as unknown as SupabaseClient),
  };
}

describe("SupabaseDepotService", () => {
  it("lists depots with their active manager only (DEP-03)", async () => {
    const { order, service } = fakeClient();
    expect(await service.list()).toEqual([DEPOT]);
    expect(order).toHaveBeenCalledWith("name");
    order.mockResolvedValue({ data: [{ ...ROW, profiles: [] }], error: null });
    expect((await service.list())[0]?.manager).toBeNull();
  });

  it("gets one depot, or null", async () => {
    const { maybeSingle, service } = fakeClient();
    expect(await service.get("d1")).toEqual(DEPOT);
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await service.get("nope")).toBeNull();
  });

  it("lists depot manager accounts for the picker", async () => {
    const { roleEq, managersOrder, service } = fakeClient();
    expect(await service.listManagers()).toEqual([
      { id: "m1", fullName: "Mia Manager", email: "mia@x.test", status: "active", depotId: "d1" },
    ]);
    expect(roleEq).toHaveBeenCalledWith("role", "depot_manager");
    expect(managersOrder).toHaveBeenCalledWith("full_name");
  });

  it("reports read failures and malformed rows as unavailable", async () => {
    const { order, maybeSingle, managersOrder, service } = fakeClient();
    order.mockResolvedValue({ data: null, error: { message: "x" } });
    await expect(service.list()).rejects.toEqual(new DepotError("unavailable"));
    maybeSingle.mockResolvedValue({ data: null, error: { message: "x" } });
    await expect(service.get("d1")).rejects.toEqual(new DepotError("unavailable"));
    maybeSingle.mockResolvedValue({ data: { ...ROW, phones: "x" }, error: null });
    await expect(service.get("d1")).rejects.toEqual(new DepotError("unavailable"));
    managersOrder.mockResolvedValue({ data: null, error: { message: "x" } });
    await expect(service.listManagers()).rejects.toEqual(new DepotError("unavailable"));
    managersOrder.mockResolvedValue({ data: [{ ...MANAGER_ROW, status: "gone" }], error: null });
    await expect(service.listManagers()).rejects.toEqual(new DepotError("unavailable"));
  });

  it("saves through admin_save_depot", async () => {
    const { client, service } = fakeClient();
    expect(await service.save(INPUT)).toBe("d9");
    expect(client.rpc).toHaveBeenCalledWith("admin_save_depot", {
      target_depot_id: null,
      depot_name: "Akwa",
      depot_location: "Douala",
      depot_address: "Market",
      depot_phones: [],
      depot_status: "active",
      manager_id: "m1",
    });
    await service.save(INPUT, "d1");
    expect(client.rpc).toHaveBeenLastCalledWith(
      "admin_save_depot",
      expect.objectContaining({ target_depot_id: "d1" }),
    );
  });

  it.each([
    ["INVALID_DEPOT", "invalid"],
    ["NOT_FOUND", "not_found"],
    ["NOT_A_MANAGER", "not_a_manager"],
    ["NOT_ADMIN", "not_admin"],
    ["Failed to fetch", "unavailable"],
  ])("maps the database refusal %s to %s", async (message, code) => {
    const { client, service } = fakeClient();
    client.rpc.mockResolvedValue({ data: null, error: { message } });
    await expect(service.save(INPUT)).rejects.toEqual(new DepotError(code as DepotError["code"]));
  });

  it("treats an unexpected save answer as unavailable", async () => {
    const { client, service } = fakeClient();
    client.rpc.mockResolvedValue({ data: 7, error: null });
    await expect(service.save(INPUT)).rejects.toEqual(new DepotError("unavailable"));
  });
});
