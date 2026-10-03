/**
 * Tests for the user form rules.
 *
 * Rules under test: USR-02 (name and email required, phones optional in
 * Cameroon format — Q-57i), Q-57a (the admin types a temporary password when
 * creating), USR-03 / Q-57c (an active depot manager needs a depot; others
 * have none), DEP-03 (who is replaced or left without a depot), USR-06 (the
 * last active admin).
 */
import { describe, expect, it } from "vitest";

import {
  assignableDepots,
  depotConsequences,
  emptyUserForm,
  isLastActiveAdmin,
  userFormFrom,
  validateUserForm,
} from "./users";

import type { Depot, User } from "@/types/entities";

const AKWA: Depot = {
  id: "d-akwa",
  name: "Akwa",
  location: "Douala",
  address: "Market",
  phones: [],
  status: "active",
  manager: { id: "u-mia", fullName: "Mia Manager" },
};
const BONABERI: Depot = { ...AKWA, id: "d-bon", name: "Bonaberi", manager: null };

const MIA: User = {
  id: "u-mia",
  fullName: "Mia Manager",
  email: "mia@x.test",
  phones: ["+237677123456"],
  role: "depot_manager",
  status: "active",
  depot: { id: "d-akwa", name: "Akwa" },
};
const ADMIN: User = {
  id: "u-admin",
  fullName: "Ama Admin",
  email: "ama@x.test",
  phones: [],
  role: "admin",
  status: "active",
  depot: null,
};

const filled = {
  ...emptyUserForm(),
  fullName: " Ann Distributor ",
  email: " Ann@Example.test ",
  password: "temp-pass-1",
  repeat: "temp-pass-1",
};

describe("validateUserForm: creating", () => {
  it("accepts a distributor, trims the text and lower-cases the email", () => {
    expect(validateUserForm(filled, { creating: true })).toEqual({
      errors: {},
      input: {
        fullName: "Ann Distributor",
        email: "ann@example.test",
        phones: [],
        role: "distributor",
        status: "active",
        depotId: null,
      },
      password: "temp-pass-1",
    });
  });

  it("requires a name and an email", () => {
    const result = validateUserForm({ ...filled, fullName: " ", email: "" }, { creating: true });
    expect(result.errors).toEqual({ fullName: "name_required", email: "email_required" });
    expect(result.input).toBeUndefined();
  });

  it("refuses an email that is not an email", () => {
    expect(validateUserForm({ ...filled, email: "ann" }, { creating: true }).errors.email).toBe(
      "email_invalid",
    );
  });

  it("Q-57a: requires the temporary password, typed twice the same", () => {
    expect(validateUserForm({ ...filled, password: "", repeat: "" }, { creating: true }).errors).toEqual({
      password: "new_password_required",
    });
    expect(validateUserForm({ ...filled, repeat: "other" }, { creating: true }).errors).toEqual({
      repeat: "passwords_differ",
    });
  });

  it("Q-57i: stores each phone as +237…, skips empty rows and repeats, flags the wrong ones", () => {
    const ok = validateUserForm(
      { ...filled, phones: ["677 12 34 56", "", "+237 677123456", "2 33 44 55 66"] },
      { creating: true },
    );
    expect(ok.input?.phones).toEqual(["+237677123456", "+237233445566"]);
    const bad = validateUserForm({ ...filled, phones: ["677123456", "12345"] }, { creating: true });
    expect(bad.errors.phones).toEqual({ 1: "phone_invalid" });
  });

  it("USR-03: an active depot manager needs a depot", () => {
    const manager = { ...filled, role: "depot_manager" as const };
    expect(validateUserForm(manager, { creating: true }).errors).toEqual({ depot: "depot_required" });
    expect(validateUserForm({ ...manager, depotId: "d-akwa" }, { creating: true }).input?.depotId).toBe(
      "d-akwa",
    );
  });

  it("Q-57c: an inactive manager has no depot, and a depot picked earlier is dropped", () => {
    const result = validateUserForm(
      { ...filled, role: "depot_manager", active: false, depotId: "d-akwa" },
      { creating: true },
    );
    expect(result.errors).toEqual({});
    expect(result.input).toMatchObject({ status: "inactive", depotId: null });
  });

  it("USR-03: a distributor or admin has no depot, even if one was picked before the role changed", () => {
    expect(validateUserForm({ ...filled, depotId: "d-akwa" }, { creating: true }).input?.depotId).toBeNull();
    expect(
      validateUserForm({ ...filled, role: "admin", depotId: "d-akwa" }, { creating: true }).input?.depotId,
    ).toBeNull();
  });
});

describe("validateUserForm: editing", () => {
  it("needs no password, and sends none", () => {
    const edit = userFormFrom(MIA);
    const result = validateUserForm(edit, { creating: false });
    expect(result.errors).toEqual({});
    expect(result.password).toBeUndefined();
    expect(result.input).toEqual({
      fullName: "Mia Manager",
      email: "mia@x.test",
      phones: ["+237677123456"],
      role: "depot_manager",
      status: "active",
      depotId: "d-akwa",
    });
  });
});

describe("form values", () => {
  it("starts empty: an active distributor with one empty phone row", () => {
    expect(emptyUserForm()).toEqual({
      fullName: "",
      email: "",
      phones: [""],
      role: "distributor",
      depotId: null,
      active: true,
      password: "",
      repeat: "",
    });
  });

  it("fills the form from a saved account, showing phones grouped", () => {
    expect(userFormFrom(MIA)).toMatchObject({
      fullName: "Mia Manager",
      phones: ["+237 6 77 12 34 56"],
      role: "depot_manager",
      depotId: "d-akwa",
      active: true,
    });
    expect(userFormFrom({ ...ADMIN, status: "inactive" })).toMatchObject({
      phones: [""],
      depotId: null,
      active: false,
    });
  });
});

describe("depotConsequences (DEP-03, Q-57c)", () => {
  const depots = [AKWA, BONABERI];

  it("names the manager who is replaced when another account takes a depot", () => {
    const form = { ...emptyUserForm(), role: "depot_manager" as const, depotId: "d-akwa" };
    expect(depotConsequences(form, undefined, depots)).toEqual({ replaced: AKWA.manager, leaves: null });
  });

  it("replaces nobody when the depot has no manager, or the account already runs it", () => {
    const toBonaberi = { ...userFormFrom(ADMIN), role: "depot_manager" as const, depotId: "d-bon" };
    expect(depotConsequences(toBonaberi, ADMIN, depots)).toEqual({ replaced: null, leaves: null });
    expect(depotConsequences(userFormFrom(MIA), MIA, depots)).toEqual({ replaced: null, leaves: null });
  });

  it("names the depot left without a manager when a manager moves, changes role or is deactivated", () => {
    expect(depotConsequences({ ...userFormFrom(MIA), depotId: "d-bon" }, MIA, depots)).toEqual({
      replaced: null,
      leaves: "Akwa",
    });
    expect(
      depotConsequences({ ...userFormFrom(MIA), role: "distributor", depotId: null }, MIA, depots).leaves,
    ).toBe("Akwa");
    expect(depotConsequences({ ...userFormFrom(MIA), active: false }, MIA, depots).leaves).toBe("Akwa");
  });

  it("has no consequence for other roles or an unknown depot", () => {
    expect(depotConsequences(emptyUserForm(), undefined, depots)).toEqual({ replaced: null, leaves: null });
    expect(
      depotConsequences({ ...emptyUserForm(), role: "depot_manager", depotId: "gone" }, undefined, depots),
    ).toEqual({ replaced: null, leaves: null });
  });
});

describe("isLastActiveAdmin (USR-06)", () => {
  it("is true only for the one active admin", () => {
    expect(isLastActiveAdmin([ADMIN, MIA], "u-admin")).toBe(true);
    expect(isLastActiveAdmin([ADMIN, { ...ADMIN, id: "u-two" }], "u-admin")).toBe(false);
    expect(
      isLastActiveAdmin(
        [
          { ...ADMIN, status: "inactive" },
          { ...ADMIN, id: "u-two" },
        ],
        "u-admin",
      ),
    ).toBe(false);
    expect(isLastActiveAdmin([ADMIN, MIA], "u-mia")).toBe(false);
  });
});

describe("assignableDepots (Q-58a: inactive depots are not offered to a manager)", () => {
  const CLOSED: Depot = { ...BONABERI, id: "d-closed", name: "Closed", status: "inactive" };

  it("offers active depots only", () => {
    expect(assignableDepots([AKWA, CLOSED, BONABERI])).toEqual([AKWA, BONABERI]);
  });
});
