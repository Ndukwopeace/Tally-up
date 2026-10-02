/**
 * Tests for the product form rules.
 *
 * Rules under test:
 *  - PRD-02 / Q-57h: name, code (letters, numbers, dashes, ≤ 20) and description required.
 *  - PRD-03 / Q-57d: Loaf always; Pack and Caisse optional.
 *  - PRD-04: a Pack or Caisse holds at least one loaf, whole numbers only.
 *  - PRD-05: Caisse entered as N Loaves or N Packs; stored as loaves.
 */
import { describe, expect, it } from "vitest";

import {
  caisseLoaves,
  emptyProductForm,
  productFormFrom,
  productUnits,
  validateProductForm,
} from "./products";

import type { Product } from "@/types/entities";

const valid = {
  ...emptyProductForm(),
  name: " Big Bread ",
  code: " BB-01 ",
  description: " Large white loaf ",
};

describe("validateProductForm", () => {
  it("accepts a Loaf-only product and trims text", () => {
    expect(validateProductForm(valid)).toEqual({
      errors: {},
      input: {
        name: "Big Bread",
        code: "BB-01",
        description: "Large white loaf",
        status: "active",
        packLoaves: null,
        caisseLoaves: null,
      },
    });
  });

  it("requires name, code and description", () => {
    const { errors, input } = validateProductForm(emptyProductForm());
    expect(errors).toEqual({
      name: "name_required",
      code: "code_required",
      description: "description_required",
    });
    expect(input).toBeUndefined();
  });

  it.each(["BB 01", "BB_01", "PAIN-É", "ABCDEFGHIJKLMNOPQRSTU"])("Q-57h: refuses the code %j", (code) => {
    expect(validateProductForm({ ...valid, code }).errors.code).toBe("code_invalid");
  });

  it("stores Pack in loaves (PRD-04)", () => {
    const result = validateProductForm({ ...valid, pack: { on: true, loaves: 10 } });
    expect(result.input?.packLoaves).toBe(10);
  });

  it("needs a whole number of at least one loaf per Pack", () => {
    expect(validateProductForm({ ...valid, pack: { on: true, loaves: null } }).errors.packLoaves).toBe(
      "loaves_required",
    );
    expect(validateProductForm({ ...valid, pack: { on: true, loaves: 0 } }).errors.packLoaves).toBe(
      "loaves_min_one",
    );
  });

  it("ignores a Pack value when Pack is switched off", () => {
    expect(validateProductForm({ ...valid, pack: { on: false, loaves: 7 } }).input?.packLoaves).toBeNull();
  });

  it("PRD-05: Caisse entered in loaves", () => {
    const form = { ...valid, caisse: { on: true, mode: "loaves" as const, count: 50 } };
    expect(validateProductForm(form).input?.caisseLoaves).toBe(50);
  });

  it("PRD-05: Caisse entered as packs is stored in loaves (5 Packs × 10 = 50)", () => {
    const form = {
      ...valid,
      pack: { on: true, loaves: 10 },
      caisse: { on: true, mode: "packs" as const, count: 5 },
    };
    expect(validateProductForm(form).input).toMatchObject({ packLoaves: 10, caisseLoaves: 50 });
  });

  it("Caisse in packs needs Pack to be set up first", () => {
    const form = { ...valid, caisse: { on: true, mode: "packs" as const, count: 5 } };
    expect(validateProductForm(form).errors.caisseCount).toBe("caisse_needs_pack");
  });

  it("needs the Caisse amount, at least one", () => {
    const missing = { ...valid, caisse: { on: true, mode: "loaves" as const, count: null } };
    expect(validateProductForm(missing).errors.caisseCount).toBe("loaves_required");
    const zero = { ...valid, caisse: { on: true, mode: "loaves" as const, count: 0 } };
    expect(validateProductForm(zero).errors.caisseCount).toBe("loaves_min_one");
  });

  it("refuses a Caisse too large to store", () => {
    const form = {
      ...valid,
      pack: { on: true, loaves: 1_000_000 },
      caisse: { on: true, mode: "packs" as const, count: 1_000_000 },
    };
    expect(validateProductForm(form).errors.caisseCount).toBe("too_large");
  });

  it("saves Inactive when switched off (PRD-01)", () => {
    expect(validateProductForm({ ...valid, active: false }).input?.status).toBe("inactive");
  });
});

describe("caisseLoaves", () => {
  it("is null while Caisse is off or incomplete", () => {
    expect(caisseLoaves(emptyProductForm())).toBeNull();
    expect(caisseLoaves({ ...valid, caisse: { on: true, mode: "packs", count: 5 } })).toBeNull();
  });
});

const product: Product = {
  id: "p1",
  name: "Big Bread",
  code: "BB-01",
  description: "Large",
  status: "inactive",
  packLoaves: 10,
  caisseLoaves: 50,
};

describe("productFormFrom", () => {
  it("fills the form from a saved product, Caisse shown in loaves", () => {
    expect(productFormFrom(product)).toEqual({
      name: "Big Bread",
      code: "BB-01",
      description: "Large",
      active: false,
      pack: { on: true, loaves: 10 },
      caisse: { on: true, mode: "loaves", count: 50 },
    });
    expect(productFormFrom({ ...product, packLoaves: null, caisseLoaves: null })).toMatchObject({
      pack: { on: false, loaves: null },
      caisse: { on: false, count: null },
    });
  });
});

describe("productUnits", () => {
  it("lists Loaf first, then Pack and Caisse when used", () => {
    expect(productUnits(product)).toEqual([
      { unit: "Loaf", loaves: 1 },
      { unit: "Pack", loaves: 10 },
      { unit: "Caisse", loaves: 50 },
    ]);
    expect(productUnits({ ...product, packLoaves: null, caisseLoaves: null })).toEqual([
      { unit: "Loaf", loaves: 1 },
    ]);
  });
});
