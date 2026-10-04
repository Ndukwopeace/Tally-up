/**
 * Tests for the 24-hour flags and the age shown to the admin.
 *
 * Rules under test: COL-11 (an In Progress collection older than
 * `staleCollectionHours` is flagged), RCP-15 and Q-59f (a receipt Awaiting
 * Confirmation older than `agedReceiptHours` is flagged; its age is always shown),
 * ADM-06 (both are visible to the admin).
 */
import { describe, expect, it } from "vitest";

import { isAgedReceipt, isStaleCollection, receiptAge } from "./flags";

const NOW = new Date("2026-10-04T12:00:00Z");
const HOURS = (n: number) => new Date(NOW.getTime() - n * 3_600_000).toISOString();

describe("isStaleCollection (COL-11)", () => {
  it("flags an In Progress collection older than 24 hours", () => {
    expect(isStaleCollection(HOURS(25), "in_progress", NOW)).toBe(true);
  });

  it("does not flag one that is 24 hours old or less", () => {
    expect(isStaleCollection(HOURS(24), "in_progress", NOW)).toBe(false);
    expect(isStaleCollection(HOURS(3), "in_progress", NOW)).toBe(false);
  });

  it("never flags a Fully Distributed collection, however old", () => {
    expect(isStaleCollection(HOURS(100), "fully_distributed", NOW)).toBe(false);
  });
});

describe("isAgedReceipt (RCP-15, Q-59f)", () => {
  it("flags a receipt Awaiting Confirmation for more than 24 hours", () => {
    expect(isAgedReceipt(HOURS(30), "awaiting_confirmation", NOW)).toBe(true);
  });

  it("does not flag a recent one", () => {
    expect(isAgedReceipt(HOURS(24), "awaiting_confirmation", NOW)).toBe(false);
  });

  it("never flags a confirmed receipt", () => {
    expect(isAgedReceipt(HOURS(100), "confirmed", NOW)).toBe(false);
    expect(isAgedReceipt(HOURS(100), "confirmed_with_discrepancy", NOW)).toBe(false);
  });
});

describe("receiptAge (RCP-15)", () => {
  it("is in minutes under an hour", () => {
    expect(receiptAge(HOURS(0.5), NOW)).toEqual({ unit: "minutes", value: 30 });
  });

  it("is in hours under two days", () => {
    expect(receiptAge(HOURS(5), NOW)).toEqual({ unit: "hours", value: 5 });
    expect(receiptAge(HOURS(47), NOW)).toEqual({ unit: "hours", value: 47 });
  });

  it("is in whole days from two days", () => {
    expect(receiptAge(HOURS(48), NOW)).toEqual({ unit: "days", value: 2 });
    expect(receiptAge(HOURS(80), NOW)).toEqual({ unit: "days", value: 3 });
  });

  it("is zero minutes for something in the future or just now", () => {
    expect(receiptAge(HOURS(-1), NOW)).toEqual({ unit: "minutes", value: 0 });
  });
});
