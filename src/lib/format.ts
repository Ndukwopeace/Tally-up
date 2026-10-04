/**
 * Date formatting in the business time zone.
 *
 * WHY:  "Today" means today in Douala (Q-6, NFR-10), whatever time zone the
 *       phone or laptop is set to. Dates are shown in plain words (N2).
 * HOW:  Intl.DateTimeFormat with the time zone from business-rules.ts; built
 *       into every browser, so no date library is downloaded for this.
 * WHEN: Dashboards show today's date under their title; lists show when a record
 *       was made ("Today, 9:42 AM") and filter by a Douala calendar day.
 * SECURITY: Pure formatting of a Date; no user input.
 */
import { BUSINESS_RULES } from "@/config/business-rules";

// Created once: building an Intl formatter is relatively slow.
const TODAY_FORMAT = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: BUSINESS_RULES.businessTimeZone,
});

/** e.g. "Friday, 2 October 2026", in Douala time. */
export function formatToday(now: Date = new Date()): string {
  return TODAY_FORMAT.format(now);
}

const ZONE = BUSINESS_RULES.businessTimeZone;
const DAY_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const CLOCK_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const DATE_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});
const OFFSET_PARTS = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, timeZoneName: "longOffset" });

/** "2026-10-04": the calendar day of an instant in Douala time (Q-6): what "today" means. */
export function businessDay(date: Date): string {
  return DAY_PARTS.format(date);
}

// Reads one named part out of a formatter's output.
function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((candidate) => candidate.type === type)?.value ?? "";
}

// "9:42 AM". Built from parts, because newer browsers put a narrow no-break space before AM and PM.
function clock(date: Date): string {
  const parts = CLOCK_PARTS.formatToParts(date);
  return `${part(parts, "hour")}:${part(parts, "minute")} ${part(parts, "dayPeriod").toUpperCase()}`;
}

/**
 * RULE NFR-10: a moment in human words, in Douala time: "Today, 9:42 AM", "Yesterday, 4:10 PM",
 * or "Wed 30 Sep, 4:10 PM" for older days.
 */
export function formatWhen(instant: string | Date, now: Date = new Date()): string {
  const date = new Date(instant);
  const day = businessDay(date);
  if (day === businessDay(now)) {
    return `Today, ${clock(date)}`;
  }
  if (day === businessDay(new Date(now.getTime() - 86_400_000))) {
    return `Yesterday, ${clock(date)}`;
  }
  const parts = DATE_PARTS.formatToParts(date);
  return `${part(parts, "weekday")} ${part(parts, "day")} ${part(parts, "month")}, ${clock(date)}`;
}

// The time zone's offset from UTC at `date`, in milliseconds (Douala: +1 hour, no daylight saving).
function zoneOffsetMs(date: Date): number {
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(part(OFFSET_PARTS.formatToParts(date), "timeZoneName"));
  if (!match) {
    return 0;
  }
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3])) * 60_000;
}

/**
 * The start and end of a calendar day in Douala time, as UTC instants, for date filters
 * (a filter on "4 October" means Douala's 4 October, whatever the phone's time zone, Q-6).
 * `day` is "YYYY-MM-DD". `to` is the start of the next day (exclusive).
 */
export function dayRange(day: string): { from: string; to: string } {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  const startUtc = Date.UTC(year, month - 1, date);
  const offset = zoneOffsetMs(new Date(startUtc));
  return {
    from: new Date(startUtc - offset).toISOString(),
    to: new Date(startUtc + 86_400_000 - offset).toISOString(),
  };
}
