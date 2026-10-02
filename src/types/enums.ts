/**
 * Fixed sets of values used across the app.
 *
 * WHY:  One definition per concept, so a typo like "confirmd" is a type error
 *       rather than a silent bug (ENGINEERING §4, meaningful names).
 * HOW:  `as const` arrays give both a runtime list and a TypeScript union type.
 * WHEN: Imported by components, services and (from Milestone 2) database types.
 * SECURITY: None directly. Values mirror database enums so the browser and the
 *       database agree on what each status means.
 */

/** The three roles. No others exist (REQUIREMENTS §4). */
export const ROLES = ["admin", "distributor", "depot_manager"] as const;
export type Role = (typeof ROLES)[number];

/** Units a product can be counted in. Loaf is the base unit (PRD-03, PRD-04). */
export const UNITS = ["Loaf", "Pack", "Caisse"] as const;
export type Unit = (typeof UNITS)[number];

/** Computed status of a collection (COL-08, REQUIREMENTS §8). */
export const COLLECTION_STATUSES = ["in_progress", "fully_distributed"] as const;
export type CollectionStatus = (typeof COLLECTION_STATUSES)[number];

/** Computed status of a depot receipt (RCP-11, REQUIREMENTS §8). */
export const RECEIPT_STATUSES = ["awaiting_confirmation", "confirmed", "confirmed_with_discrepancy"] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

/** Every status a StatusBadge can show (NFR-11: one badge component for all). */
export type Status = CollectionStatus | ReceiptStatus;
