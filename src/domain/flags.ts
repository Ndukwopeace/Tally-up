/**
 * The 24-hour flags and the age of a waiting receipt (COL-11, RCP-15, ADM-06, Q-59f).
 *
 * WHY:  Nothing happens automatically to an old collection or receipt, but the
 *       admin must see it (COL-11, RCP-15). A collection still In Progress, or a
 *       receipt still Awaiting Confirmation, for more than 24 hours is flagged;
 *       the age of a waiting receipt is always shown.
 * HOW:  Pure functions over an instant, a status and "now". The limits are the
 *       configurable `staleCollectionHours` and `agedReceiptHours`
 *       (config/business-rules.ts, REQUIREMENTS §11). Statuses come from the
 *       database; these functions never decide a status.
 * WHEN: The Collections and Distributions lists, the detail pages and (A3b-2) Home.
 * SECURITY: Display only; no I/O.
 */
import { BUSINESS_RULES } from "@/config/business-rules";
import type { CollectionStatus, ReceiptStatus } from "@/types/enums";

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * HOUR_MS;

function hoursSince(instant: string, now: Date): number {
  return (now.getTime() - new Date(instant).getTime()) / HOUR_MS;
}

/** RULE COL-11: an In Progress collection older than `staleCollectionHours`. */
export function isStaleCollection(createdAt: string, status: CollectionStatus, now: Date): boolean {
  return status === "in_progress" && hoursSince(createdAt, now) > BUSINESS_RULES.staleCollectionHours;
}

/** RULE RCP-15 / Q-59f: a receipt Awaiting Confirmation for longer than `agedReceiptHours`. */
export function isAgedReceipt(createdAt: string, status: ReceiptStatus, now: Date): boolean {
  return status === "awaiting_confirmation" && hoursSince(createdAt, now) > BUSINESS_RULES.agedReceiptHours;
}

/** An age as a number and a unit; the screen turns it into words ("3 hours"). */
export interface Age {
  unit: "minutes" | "hours" | "days";
  value: number;
}

/** RULE RCP-15: how long ago, in minutes under an hour, hours under two days, otherwise whole days. */
export function receiptAge(since: string, now: Date): Age {
  const elapsed = Math.max(now.getTime() - new Date(since).getTime(), 0);
  if (elapsed < HOUR_MS) {
    return { unit: "minutes", value: Math.floor(elapsed / MINUTE_MS) };
  }
  if (elapsed < 2 * DAY_MS) {
    return { unit: "hours", value: Math.floor(elapsed / HOUR_MS) };
  }
  return { unit: "days", value: Math.floor(elapsed / DAY_MS) };
}
