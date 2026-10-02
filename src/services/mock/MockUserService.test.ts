/**
 * Tests for the mock UserService: it must follow the same rules as admin_save_user,
 * so page tests written against it hold for Supabase.
 *
 * Rules under test: USR-01, USR-02 (one email per account), USR-03 / Q-57c (depot),
 * USR-06 / Q-57f (self and last admin), Q-57a / Q-57b (passwords), Q-57g (role and email change).
 */
import { describe, expect, it } from "vitest";

import { MockUserService } from "./MockUserService";

import type { UserSaveInput } from "@/domain/users";
import { UserError } from "@/services/interfaces/UserService";
import type { User } from "@/types/entities";

const AKWA = { id: "d-akwa", name: "Akwa" };
const BON = { id: "d-bon", name: "Bonaberi" };
const ADMIN: User = {
  id: "u-admin",
  fullName: "Ama Admin",
  email: "ama@x.test",
  phones: [],
  role: "admin",
  status: "active",
  depot: null,
};
const MIA: User = {
  id: "u-mia",
  fullName: "Mia Manager",
  email: "mia@x.test",
  phones: ["+237677123456"],
  role: "depot_manager",
  status: "active",
  depot: AKWA,
};
const DAN: User = {
  ...ADMIN,
  id: "u-dan",
  fullName: "Dan Distributor",
  email: "dan@x.test",
  role: "distributor",
};

const INPUT: UserSaveInput = {
  fullName: "Ann Distributor",
  email: "ann@x.test",
  phones: [],
  role: "distributor",
  status: "active",
  depotId: null,
};

function service() {
  return new MockUserService([MIA, DAN, ADMIN], [AKWA, BON], "u-admin");
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof UserError ? error.code : "other";
  }
  return undefined;
}

describe("reading", () => {
  it("lists accounts by name and returns copies", async () => {
    const mock = service();
    const list = await mock.list();
    expect(list.map((user) => user.fullName)).toEqual(["Ama Admin", "Dan Distributor", "Mia Manager"]);
    list[2]?.phones.push("+237600000000");
    expect((await mock.get("u-mia"))?.phones).toEqual(["+237677123456"]);
  });

  it("returns null for an account that does not exist", async () => {
    expect(await service().get("nope")).toBeNull();
  });
});

describe("create (USR-01, Q-57a)", () => {
  it("adds the account and remembers the temporary password", async () => {
    const mock = service();
    const id = await mock.create(INPUT, "temp-1");
    expect(await mock.get(id)).toMatchObject({
      fullName: "Ann Distributor",
      email: "ann@x.test",
      status: "active",
    });
    expect(mock.passwords.get(id)).toBe("temp-1");
  });

  it("USR-02: refuses an email another account uses, whatever the case", async () => {
    expect(await codeOf(service().create({ ...INPUT, email: "MIA@x.test".toLowerCase() }, "pw"))).toBe(
      "email_taken",
    );
  });

  it("USR-03: an active depot manager needs a depot that exists", async () => {
    const manager = { ...INPUT, role: "depot_manager" as const };
    expect(await codeOf(service().create(manager, "pw"))).toBe("depot_required");
    expect(await codeOf(service().create({ ...manager, depotId: "gone" }, "pw"))).toBe("invalid");
  });

  it("Q-57c: a manager put in charge of a depot deactivates the one who ran it", async () => {
    const mock = service();
    const id = await mock.create({ ...INPUT, role: "depot_manager", depotId: "d-akwa" }, "pw");
    expect(await mock.get(id)).toMatchObject({ status: "active", depot: AKWA });
    expect(await mock.get("u-mia")).toMatchObject({ status: "inactive", depot: null });
  });
});

describe("update (USR-01, Q-57g)", () => {
  it("changes the email and the role, and a manager given another role loses the depot", async () => {
    const mock = service();
    await mock.update("u-mia", { ...INPUT, email: "mia.new@x.test", role: "distributor" });
    expect(await mock.get("u-mia")).toMatchObject({
      email: "mia.new@x.test",
      role: "distributor",
      depot: null,
    });
  });

  it("keeps an account's own email without calling it taken", async () => {
    expect(
      await codeOf(service().update("u-mia", { ...INPUT, email: "mia@x.test", role: "distributor" })),
    ).toBeUndefined();
  });

  it("Q-57c: deactivating a manager takes them off the depot; reactivating needs a depot", async () => {
    const mock = service();
    await mock.update("u-mia", { ...INPUT, role: "depot_manager", status: "inactive" });
    expect(await mock.get("u-mia")).toMatchObject({ status: "inactive", depot: null });
    expect(await codeOf(mock.update("u-mia", { ...INPUT, role: "depot_manager" }))).toBe("depot_required");
    await mock.update("u-mia", { ...INPUT, role: "depot_manager", depotId: "d-bon" });
    expect(await mock.get("u-mia")).toMatchObject({ status: "active", depot: BON });
  });

  it("says not found for an account that does not exist", async () => {
    expect(await codeOf(service().update("nope", INPUT))).toBe("not_found");
  });

  it("USR-06: an admin cannot deactivate themselves", async () => {
    expect(await codeOf(service().update("u-admin", { ...INPUT, role: "admin", status: "inactive" }))).toBe(
      "cannot_deactivate_self",
    );
  });

  it("USR-06: the last active admin keeps the role; with another admin they may change it", async () => {
    const mock = service();
    expect(await codeOf(mock.update("u-admin", { ...INPUT, role: "distributor" }))).toBe("last_admin");
    await mock.create({ ...INPUT, email: "two@x.test", role: "admin" }, "pw");
    expect(await codeOf(mock.update("u-admin", { ...INPUT, role: "distributor" }))).toBeUndefined();
  });
});

describe("resetPassword (USR-04, Q-57b)", () => {
  it("sets the new temporary password", async () => {
    const mock = service();
    await mock.resetPassword("u-mia", "new-temp");
    expect(mock.passwords.get("u-mia")).toBe("new-temp");
  });

  it("says not found for an account that does not exist", async () => {
    expect(await codeOf(service().resetPassword("nope", "pw"))).toBe("not_found");
  });
});

describe("test helpers", () => {
  it("fails the next call once, then works", async () => {
    const mock = service();
    mock.failNextCallWith("unavailable");
    expect(await codeOf(mock.list())).toBe("unavailable");
    expect(await mock.list()).toHaveLength(3);
  });

  it("holds the next call until released", async () => {
    const mock = service();
    const release = mock.holdNextCall();
    let done = false;
    const pending = mock.list().then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    release();
    await pending;
    expect(done).toBe(true);
  });
});
