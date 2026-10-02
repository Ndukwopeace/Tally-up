/**
 * Tests for the depot form rules.
 *
 * Rules under test: DEP-02 (name, location, address required; phones optional,
 * Cameroon format — Q-57i), DEP-01 (Active/Inactive), DEP-03 / Q-57c (the
 * manager being replaced).
 */
import { describe, expect, it } from "vitest";

import { depotFormFrom, emptyDepotForm, replacedManager, validateDepotForm } from "./depots";

import type { Depot } from "@/types/entities";

const valid = { ...emptyDepotForm(), name: " Akwa ", location: " Douala ", address: " Near the market " };

describe("validateDepotForm", () => {
  it("accepts a depot with no phone and trims text", () => {
    expect(validateDepotForm(valid)).toEqual({
      errors: {},
      input: {
        name: "Akwa",
        location: "Douala",
        address: "Near the market",
        phones: [],
        status: "active",
        managerId: null,
      },
    });
  });

  it("requires name, location and address", () => {
    expect(validateDepotForm(emptyDepotForm()).errors).toEqual({
      name: "name_required",
      location: "location_required",
      address: "address_required",
    });
  });

  it("Q-57i: stores each phone as +237…, skips empty rows and repeats", () => {
    const result = validateDepotForm({
      ...valid,
      phones: ["6 77 12 34 56", "", "+237677123456", "233 44 55 66"],
    });
    expect(result.input?.phones).toEqual(["+237677123456", "+237233445566"]);
  });

  it("Q-57i: marks each phone that is not a Cameroon number", () => {
    const result = validateDepotForm({ ...valid, phones: ["677123456", "12345", "577123456"] });
    expect(result.errors).toEqual({ phones: { 1: "phone_invalid", 2: "phone_invalid" } });
    expect(result.input).toBeUndefined();
  });

  it("saves Inactive and the chosen manager", () => {
    expect(validateDepotForm({ ...valid, active: false, managerId: "m1" }).input).toMatchObject({
      status: "inactive",
      managerId: "m1",
    });
  });
});

const depot: Depot = {
  id: "d1",
  name: "Akwa",
  location: "Douala",
  address: "Market",
  phones: ["+237677123456"],
  status: "active",
  manager: { id: "m1", fullName: "Mia" },
};

describe("depotFormFrom", () => {
  it("fills the form from a saved depot, phones shown readably", () => {
    expect(depotFormFrom(depot)).toEqual({
      name: "Akwa",
      location: "Douala",
      address: "Market",
      phones: ["+237 6 77 12 34 56"],
      active: true,
      managerId: "m1",
    });
    expect(depotFormFrom({ ...depot, manager: null, status: "inactive", phones: [] })).toMatchObject({
      managerId: null,
      active: false,
      // One empty row, ready to type a number into.
      phones: [""],
    });
  });
});

describe("replacedManager", () => {
  it("Q-57c: names the current manager when another one is chosen", () => {
    expect(replacedManager(depot, "m2")).toEqual({ id: "m1", fullName: "Mia" });
  });

  it("is null when nobody is replaced", () => {
    expect(replacedManager(depot, "m1")).toBeNull();
    expect(replacedManager(depot, null)).toBeNull();
    expect(replacedManager({ ...depot, manager: null }, "m2")).toBeNull();
    expect(replacedManager(undefined, "m2")).toBeNull();
  });
});
