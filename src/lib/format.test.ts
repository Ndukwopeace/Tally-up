/**
 * Tests for formatting "today" in the business time zone (NFR-10, Q-6).
 */
import { describe, expect, it } from "vitest";

import { formatToday } from "./format";

describe("formatToday", () => {
  it("shows the date in Douala time", () => {
    // 23:30 UTC on 1 Oct is already 00:30 on 2 Oct in Douala (UTC+1).
    expect(formatToday(new Date("2026-10-01T23:30:00Z"))).toBe("Friday, 2 October 2026");
  });

  it("does not move the date when Douala and UTC agree", () => {
    expect(formatToday(new Date("2026-10-02T12:00:00Z"))).toBe("Friday, 2 October 2026");
  });
});
