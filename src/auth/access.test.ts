/**
 * Tests for portal access rules.
 *
 * Rules under test: AUTH-07 (home per role), AUTH-09 (inactive refused),
 * Q-55 (only the admin portal is open in A1), ARCHITECTURE §13 (return to the
 * requested page after sign-in).
 */
import { describe, expect, it } from "vitest";

import { accessRefusal, OPEN_PORTALS, PORTAL_HOME, pathAfterSignIn } from "./access";

import type { Account } from "@/types/entities";

const admin: Account = { id: "1", fullName: "A", email: "a@x.test", role: "admin", status: "active" };

describe("access rules", () => {
  it("Q-55: only the admin portal is open in A1", () => {
    expect(OPEN_PORTALS).toEqual(["admin"]);
  });

  it("AUTH-07: sends each role to its own portal", () => {
    expect(PORTAL_HOME).toEqual({ admin: "/admin", distributor: "/distributor", depot_manager: "/depot" });
  });

  it("lets an active account with an open portal in", () => {
    expect(accessRefusal(admin, ["admin"])).toBeNull();
  });

  it("AUTH-09: refuses an inactive account, even an admin", () => {
    expect(accessRefusal({ ...admin, status: "inactive" }, ["admin"])).toBe("inactive");
  });

  it("refuses a role whose portal is not open yet", () => {
    expect(accessRefusal({ ...admin, role: "distributor" }, ["admin"])).toBe("portal_not_open");
    expect(accessRefusal({ ...admin, role: "distributor" }, ["admin", "distributor"])).toBeNull();
  });

  it("returns to the requested page when it is inside the user's portal", () => {
    expect(pathAfterSignIn("admin", "/admin/users")).toBe("/admin/users");
    expect(pathAfterSignIn("admin", "/admin")).toBe("/admin");
  });

  it("otherwise goes to the portal home", () => {
    expect(pathAfterSignIn("admin")).toBe("/admin");
    expect(pathAfterSignIn("admin", "/depot/receipts")).toBe("/admin");
    expect(pathAfterSignIn("admin", "/administrator")).toBe("/admin");
    expect(pathAfterSignIn("admin", "/admin/sign-out")).toBe("/admin");
  });
});
