/**
 * Date formatting in the business time zone.
 *
 * WHY:  "Today" means today in Douala (Q-6, NFR-10), whatever time zone the
 *       phone or laptop is set to. Dates are shown in plain words (N2).
 * HOW:  Intl.DateTimeFormat with the time zone from business-rules.ts; built
 *       into every browser, so no date library is downloaded for this.
 * WHEN: Dashboards show today's date under their title.
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
