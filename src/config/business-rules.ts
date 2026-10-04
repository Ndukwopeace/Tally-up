/**
 * Company policy values that the requirements leave configurable.
 *
 * WHY:  The specification says: when a rule is missing, isolate it as config
 *       instead of hard-coding company policy. Every value here is an owner
 *       decision recorded in REQUIREMENTS.md §11 / §12.
 * HOW:  One frozen object. Code reads values from here; it never repeats them.
 *       business-rules.test.ts fails if a value drifts from the requirements.
 * WHEN: Read wherever "today", units, record numbers or stale-collection
 *       flags are computed (from Milestone 2 onward).
 * SECURITY: Frozen, so no code path can change policy while the app runs.
 *       The database holds its own copy of rules that protect data (SEC-1);
 *       these browser values are for display and early validation only.
 */

/** How a record number is built: prefix + sequence padded to `digits`, e.g. DIS-00018. */
export interface RecordNumberFormat {
  readonly prefix: string;
  readonly digits: number;
}

export interface BusinessRules {
  /** IANA time zone that defines "today" for KPIs and reports (Q-6, NFR-10). */
  readonly businessTimeZone: string;
  /** Unit every quantity is converted to for balances and comparisons (PRD-04). */
  readonly baseUnit: "Loaf";
  /** Whole numbers only (Q-20). Kept as config per spec §58; changing it needs an owner decision. */
  readonly allowDecimalQuantities: boolean;
  /** Collection numbers, e.g. COL-00003 (REQUIREMENTS §11). */
  readonly collectionNumberFormat: RecordNumberFormat;
  /** Hand-over / receipt numbers, e.g. DIS-00018 (Q-39). */
  readonly distributionNumberFormat: RecordNumberFormat;
  /** Hours an In Progress collection may wait before it is flagged to Admin (COL-11). */
  readonly staleCollectionHours: number;
  /** Hours a receipt may stay Awaiting Confirmation before it is flagged to Admin (RCP-15, Q-59f). */
  readonly agedReceiptHours: number;
}

export const BUSINESS_RULES: BusinessRules = Object.freeze({
  businessTimeZone: "Africa/Douala",
  baseUnit: "Loaf",
  allowDecimalQuantities: false,
  collectionNumberFormat: Object.freeze({ prefix: "COL-", digits: 5 }),
  distributionNumberFormat: Object.freeze({ prefix: "DIS-", digits: 5 }),
  staleCollectionHours: 24,
  agedReceiptHours: 24,
});
