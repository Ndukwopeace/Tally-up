/**
 * Tests for the mock DepotService: it follows admin_save_depot's rules
 * (DEP-03, Q-57c) so tests built on it hold for Supabase.
 */
import { describe, expect, it } from "vitest";

import { MockDepotService } from "./MockDepotService";

import { DepotError } from "@/services/interfaces/DepotService";

const INPUT = {
  name: "Akwa",
  location: "Douala",
  address: "Market",
  phones: ["+237677123456"],
  status: "active" as const,
  managerId: null,
};
const managers = [
  { id: "m1", fullName: "Mia", email: "mia@x.test", status: "inactive" as const, depotId: null },
  { id: "m2", fullName: "Ben", email: "ben@x.test", status: "inactive" as const, depotId: null },
];

describe("MockDepotService", () => {
  it("creates, lists by name, gets and edits depots", async () => {
    const service = new MockDepotService();
    const id = await service.save(INPUT);
    await service.save({ ...INPUT, name: "Bonaberi" });
    expect((await service.list()).map((depot) => depot.name)).toEqual(["Akwa", "Bonaberi"]);
    expect(await service.get(id)).toEqual({ id, ...{ ...INPUT, managerId: undefined }, manager: null });
    await service.save({ ...INPUT, status: "inactive" }, id);
    expect((await service.get(id))?.status).toBe("inactive");
    expect(await service.get("missing")).toBeNull();
    await expect(service.save(INPUT, "missing")).rejects.toEqual(new DepotError("not_found"));
  });

  it("DEP-03 / Q-57c: assigning a manager activates them; the one replaced is deactivated", async () => {
    const service = new MockDepotService([], managers);
    const id = await service.save({ ...INPUT, managerId: "m1" });
    expect((await service.get(id))?.manager).toEqual({ id: "m1", fullName: "Mia" });
    await service.save({ ...INPUT, managerId: "m2" }, id);
    expect((await service.get(id))?.manager).toEqual({ id: "m2", fullName: "Ben" });
    expect(await service.listManagers()).toEqual([
      { id: "m2", fullName: "Ben", email: "ben@x.test", status: "active", depotId: id },
      { id: "m1", fullName: "Mia", email: "mia@x.test", status: "inactive", depotId: null },
    ]);
    // Saving with no manager chosen keeps the current one.
    await service.save(INPUT, id);
    expect((await service.get(id))?.manager?.id).toBe("m2");
  });

  it("refuses an unknown manager", async () => {
    await expect(new MockDepotService().save({ ...INPUT, managerId: "nobody" })).rejects.toEqual(
      new DepotError("not_a_manager"),
    );
  });

  it("can fail or hold the next call", async () => {
    const service = new MockDepotService();
    service.failNextCallWith("unavailable");
    await expect(service.list()).rejects.toEqual(new DepotError("unavailable"));
    const release = service.holdNextCall();
    let done = false;
    const pending = service.listManagers().then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    release();
    await pending;
    expect(done).toBe(true);
  });
});
