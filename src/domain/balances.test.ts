/**
 * Tests for collection balances and receipt differences, in loaves.
 *
 * Rules under test: REC-01 (Collected = Distributed + Remaining), REC-02
 * (Difference = Counted - Recorded), REC-04 (per product, never across products),
 * COL-08 and RCP-11 (statuses are computed), RCP-06 (a line may be counted in
 * several units). The cases are the same ones supabase/tests/a3a_operations.test.sql
 * runs against the database views, so both give the same answers (ARCHITECTURE §8).
 */
import { describe, expect, it } from "vitest";

import { collectionBalances, collectionStatus, receiptLine, receiptStatus } from "./balances";

const COLLECTED = [
  { productId: "bb", quantity: 500, loavesPerUnitSnapshot: 1 },
  { productId: "bb", quantity: 10, loavesPerUnitSnapshot: 50 },
];
const HANDED_OVER = [
  { productId: "bb", quantity: 3, loavesPerUnitSnapshot: 50 },
  { productId: "bb", quantity: 100, loavesPerUnitSnapshot: 1 },
  { productId: "bb", quantity: 45, loavesPerUnitSnapshot: 10 },
];

describe("collectionBalances (REC-01)", () => {
  it("collected 1,000 loaves, handed over 700, remaining 300", () => {
    expect(collectionBalances(COLLECTED, HANDED_OVER)).toEqual([
      { productId: "bb", collectedLoaves: 1000, distributedLoaves: 700, remainingLoaves: 300 },
    ]);
  });

  it("REC-04: keeps each product apart", () => {
    const balances = collectionBalances(
      [...COLLECTED, { productId: "sb", quantity: 20, loavesPerUnitSnapshot: 5 }],
      [{ productId: "sb", quantity: 4, loavesPerUnitSnapshot: 5 }, ...HANDED_OVER],
    );
    expect(balances).toEqual([
      { productId: "bb", collectedLoaves: 1000, distributedLoaves: 700, remainingLoaves: 300 },
      { productId: "sb", collectedLoaves: 100, distributedLoaves: 20, remainingLoaves: 80 },
    ]);
  });

  it("a product with nothing handed over has everything remaining", () => {
    expect(collectionBalances(COLLECTED, [])).toEqual([
      { productId: "bb", collectedLoaves: 1000, distributedLoaves: 0, remainingLoaves: 1000 },
    ]);
  });
});

describe("collectionStatus (COL-08)", () => {
  it("is In Progress while any product has loaves remaining", () => {
    expect(collectionStatus(collectionBalances(COLLECTED, HANDED_OVER))).toBe("in_progress");
  });

  it("is Fully Distributed when every product has none remaining", () => {
    const all = [...HANDED_OVER, { productId: "bb", quantity: 300, loavesPerUnitSnapshot: 1 }];
    expect(collectionStatus(collectionBalances(COLLECTED, all))).toBe("fully_distributed");
  });
});

describe("receiptLine (REC-02, RCP-06)", () => {
  it("2 Caisse + 5 Packs count as the 150 loaves recorded as 3 Caisse: difference 0", () => {
    expect(
      receiptLine(150, [
        { quantity: 2, loavesPerUnitSnapshot: 50 },
        { quantity: 5, loavesPerUnitSnapshot: 10 },
      ]),
    ).toEqual({ recordedLoaves: 150, countedLoaves: 150, differenceLoaves: 0 });
  });

  it("95 Loaves counted against 100 recorded: difference -5", () => {
    expect(receiptLine(100, [{ quantity: 95, loavesPerUnitSnapshot: 1 }])).toEqual({
      recordedLoaves: 100,
      countedLoaves: 95,
      differenceLoaves: -5,
    });
  });

  it("RCP-07: a count may exceed what was recorded, and may be zero", () => {
    expect(receiptLine(100, [{ quantity: 120, loavesPerUnitSnapshot: 1 }]).differenceLoaves).toBe(20);
    expect(receiptLine(100, [{ quantity: 0, loavesPerUnitSnapshot: 1 }]).differenceLoaves).toBe(-100);
  });

  it("a line with no count entries has counted 0", () => {
    expect(receiptLine(40, [])).toEqual({ recordedLoaves: 40, countedLoaves: 0, differenceLoaves: -40 });
  });
});

describe("receiptStatus (RCP-11)", () => {
  const match = { recordedLoaves: 150, countedLoaves: 150, differenceLoaves: 0 };
  const short = { recordedLoaves: 100, countedLoaves: 95, differenceLoaves: -5 };

  it("is Awaiting Confirmation until the depot confirms, whatever the lines say", () => {
    expect(receiptStatus([match], false)).toBe("awaiting_confirmation");
  });

  it("is Confirmed when every line matches", () => {
    expect(receiptStatus([match, match], true)).toBe("confirmed");
  });

  it("is Confirmed with Discrepancy when any line differs", () => {
    expect(receiptStatus([match, short], true)).toBe("confirmed_with_discrepancy");
  });
});
