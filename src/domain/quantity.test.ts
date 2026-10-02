/**
 * Tests for parseQuantity: turning what a user typed into a whole-number quantity.
 *
 * Rules under test:
 *  - Q-20: quantities are whole numbers only.
 *  - P-1 (UI_GUIDELINES §1.7): accept spaces and commas used as thousands separators.
 *  - P-3: anything that cannot be cleaned is rejected, never guessed.
 */
import { describe, expect, it } from "vitest";

import { parseQuantity } from "./quantity";

describe("parseQuantity — accepts whole numbers (Q-20)", () => {
  it.each([
    ["0", 0],
    ["7", 7],
    ["200", 200],
    ["1500", 1500],
  ])("reads %j as %d", (input, expected) => {
    expect(parseQuantity(input)).toEqual({ ok: true, value: expected });
  });

  it("ignores spaces around the number", () => {
    expect(parseQuantity("  42 ")).toEqual({ ok: true, value: 42 });
  });
});

describe("parseQuantity — thousands separators (P-1)", () => {
  it.each([
    ["1,500", 1500],
    ["1 500", 1500],
    ["1\u00a0500", 1500], // non-breaking space, used by French-style number formatting
    ["1\u202f500", 1500], // narrow non-breaking space, also used in French formatting
    ["12,345,678", 12345678],
    ["1 234 567", 1234567],
  ])("reads %j as %d", (input, expected) => {
    expect(parseQuantity(input)).toEqual({ ok: true, value: expected });
  });

  it.each(["1,5", "15,00", "1,5000", ",500", "1,", "1  500"])(
    "rejects %j because the grouping is not in threes (could be a decimal comma)",
    (input) => {
      expect(parseQuantity(input)).toEqual({ ok: false, reason: "not_whole_number" });
    },
  );
});

describe("parseQuantity — rejects what it cannot read safely (P-3)", () => {
  it.each(["", "   "])("reports %j as empty", (input) => {
    expect(parseQuantity(input)).toEqual({ ok: false, reason: "empty" });
  });

  it.each(["1.5", "1.500", "0.0", "abc", "12a", "1e3", "+5", "0x10", "١٢"])(
    "rejects %j as not a whole number",
    (input) => {
      expect(parseQuantity(input)).toEqual({ ok: false, reason: "not_whole_number" });
    },
  );

  it.each(["-1", "-200", " -5 "])("rejects %j as negative", (input) => {
    expect(parseQuantity(input)).toEqual({ ok: false, reason: "negative" });
  });

  it("rejects numbers beyond what can be stored exactly", () => {
    expect(parseQuantity("9007199254740992")).toEqual({ ok: false, reason: "too_large" });
  });

  it("accepts the largest number that can be stored exactly", () => {
    expect(parseQuantity("9007199254740991")).toEqual({ ok: true, value: Number.MAX_SAFE_INTEGER });
  });
});
