/**
 * Tests for formatting "today" in the business time zone (NFR-10, Q-6).
 */
import { describe, expect, it } from "vitest";

import { dayRange, formatToday, formatWhen } from "./format";

describe("formatToday", () => {
  it("shows the date in Douala time", () => {
    // 23:30 UTC on 1 Oct is already 00:30 on 2 Oct in Douala (UTC+1).
    expect(formatToday(new Date("2026-10-01T23:30:00Z"))).toBe("Friday, 2 October 2026");
  });

  it("does not move the date when Douala and UTC agree", () => {
    expect(formatToday(new Date("2026-10-02T12:00:00Z"))).toBe("Friday, 2 October 2026");
  });
});

describe("formatWhen (NFR-10: human format in Douala time)", () => {
  const now = new Date("2026-10-04T14:00:00Z"); // 15:00 on Sunday 4 October in Douala

  it("says Today for the same Douala day", () => {
    expect(formatWhen("2026-10-04T08:42:00Z", now)).toBe("Today, 9:42 AM");
    expect(formatWhen("2026-10-04T13:05:00Z", now)).toBe("Today, 2:05 PM");
  });

  it("uses the Douala day, not the UTC day, to decide what is today", () => {
    // 23:30 UTC on 3 October is 00:30 on 4 October in Douala: still today.
    expect(formatWhen("2026-10-03T23:30:00Z", now)).toBe("Today, 12:30 AM");
  });

  it("says Yesterday for the day before", () => {
    expect(formatWhen("2026-10-03T08:00:00Z", now)).toBe("Yesterday, 9:00 AM");
  });

  it("shows the weekday and date for older days", () => {
    expect(formatWhen("2026-09-30T15:10:00Z", now)).toBe("Wed 30 Sep, 4:10 PM");
  });
});

describe("dayRange (a calendar day in Douala time, for date filters)", () => {
  it("runs from midnight Douala time to the next midnight, as UTC instants", () => {
    expect(dayRange("2026-10-04")).toEqual({
      from: "2026-10-03T23:00:00.000Z",
      to: "2026-10-04T23:00:00.000Z",
    });
  });

  it("crosses a month end", () => {
    expect(dayRange("2026-09-30")).toEqual({
      from: "2026-09-29T23:00:00.000Z",
      to: "2026-09-30T23:00:00.000Z",
    });
  });
});
