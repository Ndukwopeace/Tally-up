/**
 * Tests for Cameroon phone numbers (Q-57i).
 *
 * Rule under test: 9 digits starting with 2 (landline) or 6 (mobile), typed
 * with or without +237 / 00237 / 237 and with spaces, dots or dashes; stored
 * as +237XXXXXXXXX and shown as +237 6 77 12 34 56.
 */
import { describe, expect, it } from "vitest";

import { formatCameroonPhone, normalizeCameroonPhone } from "./phone";

describe("normalizeCameroonPhone", () => {
  it.each([
    ["677123456", "+237677123456"],
    ["6 77 12 34 56", "+237677123456"],
    ["+237 6 77 12 34 56", "+237677123456"],
    ["+237677123456", "+237677123456"],
    ["00237 677-12-34-56", "+237677123456"],
    ["237677123456", "+237677123456"],
    ["233.44.55.66", "+237233445566"],
    ["(+237) 233 44 55 66", "+237233445566"],
  ])("reads %j as %s", (raw, stored) => {
    expect(normalizeCameroonPhone(raw)).toBe(stored);
  });

  it.each([
    "",
    "67712345",
    "6771234567",
    "577123456",
    "+33 6 12 34 56 78",
    "677abc456",
    "+237 1 23 45 67 89",
  ])("refuses %j", (raw) => {
    expect(normalizeCameroonPhone(raw)).toBeNull();
  });
});

describe("formatCameroonPhone", () => {
  it("groups the digits for reading", () => {
    expect(formatCameroonPhone("+237677123456")).toBe("+237 6 77 12 34 56");
  });

  it("shows anything unexpected unchanged", () => {
    expect(formatCameroonPhone("12345")).toBe("12345");
  });
});
