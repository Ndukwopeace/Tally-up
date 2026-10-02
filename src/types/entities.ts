/**
 * Shapes of the records the app works with (ARCHITECTURE §3.2 `types/entities.ts`).
 *
 * WHY:  One definition per record, shared by pages, hooks and services, so the
 *       screens and the data layer cannot disagree on a field name.
 * HOW:  Plain TypeScript interfaces in camelCase. Services convert database
 *       rows (snake_case) into these.
 * WHEN: Imported wherever a record is passed around. Grows milestone by milestone.
 * SECURITY: Types only. What a user may read is decided by RLS, not by these types.
 */
import type { RecordStatus, Role, Unit } from "./enums";

/** A Tally-Up account: one row of `profiles` (REQUIREMENTS §9 User, USR-02). */
export interface Account {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: RecordStatus;
}

/**
 * A bread product and its units (REQUIREMENTS §9 Product + ProductUnit, PRD-02 to PRD-04).
 * Loaf is always a unit, worth 1 loaf (Q-57d); Pack and Caisse are null when unused.
 */
export interface Product {
  id: string;
  name: string;
  code: string;
  description: string;
  status: RecordStatus;
  /** Loaves in one Pack, or null when the product is not sold in Packs. */
  packLoaves: number | null;
  /** Loaves in one Caisse, or null when the product is not sold in Caisses. */
  caisseLoaves: number | null;
}

/** One unit of a product and how many loaves it holds. */
export interface ProductUnitLoaves {
  unit: Unit;
  loaves: number;
}

/** The manager running a depot, as shown with the depot. */
export interface DepotManagerRef {
  id: string;
  fullName: string;
}

/** A depot (REQUIREMENTS §9 Depot, DEP-02). */
export interface Depot {
  id: string;
  name: string;
  location: string;
  /** "Address/Description" (DEP-02). */
  address: string;
  /** Stored as +237XXXXXXXXX (Q-57i); may be empty. */
  phones: string[];
  status: RecordStatus;
  /** The active manager, or null when the depot has none (DEP-03). */
  manager: DepotManagerRef | null;
}

/** A depot manager account, as offered in the depot form's manager list. */
export interface ManagerOption {
  id: string;
  fullName: string;
  email: string;
  status: RecordStatus;
  /** The depot they run now, or null. */
  depotId: string | null;
}
