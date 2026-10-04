/**
 * Tests for loaf conversion and breakdowns.
 *
 * Rules under test: PRD-04 / PRD-06 (everything is converted to loaves with the
 * value frozen at submit time), Q-20 (whole numbers only), DIS-02 (a remaining
 * amount is shown in loaves with its breakdown), DIS-06 (how many of a unit fit).
 * The numbers are the spec's: Big Bread, 1 Pack = 10 Loaves, 1 Caisse = 50 Loaves.
 */
import { describe, expect, it } from "vitest";

import { breakdown, maxGiveable, toLoaves } from "./units";

import type { ProductUnitLoaves } from "@/types/entities";

const UNITS: ProductUnitLoaves[] = [
  { unit: "Loaf", loaves: 1 },
  { unit: "Pack", loaves: 10 },
  { unit: "Caisse", loaves: 50 },
];

describe("toLoaves", () => {
  it("multiplies a quantity by its loaves per unit", () => {
    expect(toLoaves(10, 50)).toBe(500);
    expect(toLoaves(45, 10)).toBe(450);
    expect(toLoaves(95, 1)).toBe(95);
    expect(toLoaves(0, 50)).toBe(0);
  });

  it("Q-20: refuses fractions rather than rounding them", () => {
    expect(() => toLoaves(1.5, 10)).toThrow(RangeError);
    expect(() => toLoaves(2, 0.5)).toThrow(RangeError);
  });

  it("refuses a negative quantity, which could inflate remaining stock", () => {
    expect(() => toLoaves(-1, 10)).toThrow(RangeError);
  });

  it("refuses a loaves-per-unit below one", () => {
    expect(() => toLoaves(3, 0)).toThrow(RangeError);
  });
});

describe("breakdown (DIS-02)", () => {
  it("shows 430 loaves as 8 Caisse + 3 Packs, largest unit first", () => {
    expect(breakdown(430, UNITS)).toEqual([
      { unit: "Caisse", quantity: 8 },
      { unit: "Pack", quantity: 3 },
    ]);
  });

  it("keeps the loaves that do not fill a Pack", () => {
    expect(breakdown(463, UNITS)).toEqual([
      { unit: "Caisse", quantity: 9 },
      { unit: "Pack", quantity: 1 },
      { unit: "Loaf", quantity: 3 },
    ]);
  });

  it("is empty for zero loaves", () => {
    expect(breakdown(0, UNITS)).toEqual([]);
  });

  it("uses only the units the product has, whatever order they are given in", () => {
    expect(
      breakdown(105, [
        { unit: "Loaf", loaves: 1 },
        { unit: "Pack", loaves: 10 },
      ]),
    ).toEqual([
      { unit: "Pack", quantity: 10 },
      { unit: "Loaf", quantity: 5 },
    ]);
    expect(
      breakdown(60, [
        { unit: "Caisse", loaves: 50 },
        { unit: "Pack", loaves: 10 },
        { unit: "Loaf", loaves: 1 },
      ]),
    ).toEqual([
      { unit: "Caisse", quantity: 1 },
      { unit: "Pack", quantity: 1 },
    ]);
  });

  it("refuses a negative or fractional amount", () => {
    expect(() => breakdown(-1, UNITS)).toThrow(RangeError);
    expect(() => breakdown(1.5, UNITS)).toThrow(RangeError);
  });
});

describe("maxGiveable (DIS-06)", () => {
  it("is how many whole units fit in the remaining loaves", () => {
    expect(maxGiveable(43, 10)).toBe(4);
    expect(maxGiveable(43, 1)).toBe(43);
    expect(maxGiveable(9, 10)).toBe(0);
  });

  it("refuses a negative remaining or a loaves-per-unit below one", () => {
    expect(() => maxGiveable(-1, 10)).toThrow(RangeError);
    expect(() => maxGiveable(10, 0)).toThrow(RangeError);
  });
});
