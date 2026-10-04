/**
 * The fixed "now" and the spec's example data for the monitoring screens' tests.
 *
 * WHY:  Flags and "Today" labels depend on the clock, so tests fix it.
 * HOW:  Re-exports the example data from the mock, counted back from FIXTURE_NOW.
 * WHEN: Imported by tests only.
 * SECURITY: Fictional.
 */
import { specOperations as specOperationsAt } from "@/services/mock/specOperations";

export const FIXTURE_NOW = new Date("2026-10-04T12:00:00Z");

export function specOperations() {
  return specOperationsAt(FIXTURE_NOW);
}
