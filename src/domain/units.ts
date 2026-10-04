/**
 * Loaf conversion and breakdowns (PRD-04, PRD-06, Q-20, DIS-02, DIS-06).
 *
 * WHY:  All balances and comparisons are done in loaves, because distributors
 *       and depot managers may use different units. These few functions are the
 *       one place that converts, so no screen repeats the arithmetic.
 * HOW:  Pure functions, no React or network. `toLoaves` multiplies by the
 *       loaves-per-unit value captured when the record was submitted (the
 *       snapshot), so later admin edits never rewrite history. `breakdown` splits
 *       a loaf amount into the product's units, largest first. `maxGiveable` says
 *       how many whole units fit. The SQL views do the same sums; the same test
 *       cases run against both (ARCHITECTURE §8).
 * WHEN: Balances, receipt differences, the live totals while typing quantities,
 *       and the "430 Loaves (8 Caisse + 3 Packs)" display.
 * SECURITY: No I/O. Rejects fractions and negatives so bad input cannot create
 *       fractional or negative stock.
 */
import type { ProductUnitLoaves, UnitQuantity } from "@/types/entities";

/**
 * Converts a quantity in any unit into loaves.
 *
 * RULE Q-20: whole numbers only; fails loudly rather than rounding silently.
 */
export function toLoaves(quantity: number, loavesPerUnit: number): number {
  if (!Number.isInteger(quantity) || !Number.isInteger(loavesPerUnit)) {
    throw new RangeError("Quantities must be whole numbers");
  }
  // SECURITY: a negative quantity could be used to inflate "remaining" stock.
  if (quantity < 0 || loavesPerUnit <= 0) {
    throw new RangeError("Quantity must be 0 or more and loaves per unit at least 1");
  }
  return quantity * loavesPerUnit;
}

/**
 * RULE DIS-02: splits `loaves` into the product's units, largest first, leaving out
 * units with nothing in them. 430 loaves with Caisse = 50 and Pack = 10 gives
 * 8 Caisse + 3 Packs.
 */
export function breakdown(loaves: number, units: readonly ProductUnitLoaves[]): UnitQuantity[] {
  if (!Number.isInteger(loaves) || loaves < 0) {
    throw new RangeError("Loaves must be a whole number, 0 or more");
  }
  const parts: UnitQuantity[] = [];
  let left = loaves;
  for (const { unit, loaves: perUnit } of [...units].sort((a, b) => b.loaves - a.loaves)) {
    const quantity = Math.floor(left / perUnit);
    if (quantity > 0) {
      parts.push({ unit, quantity });
      left -= quantity * perUnit;
    }
  }
  return parts;
}

/** RULE DIS-06: how many whole units of `loavesPerUnit` fit in `remainingLoaves`. */
export function maxGiveable(remainingLoaves: number, loavesPerUnit: number): number {
  if (remainingLoaves < 0 || loavesPerUnit <= 0) {
    throw new RangeError("Remaining must be 0 or more and loaves per unit at least 1");
  }
  return Math.floor(remainingLoaves / loavesPerUnit);
}
