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
import type { CollectionStatus, ReceiptStatus, RecordStatus, Role, Unit } from "./enums";

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

/** The depot an active depot manager runs, as shown with their account. */
export interface UserDepotRef {
  id: string;
  name: string;
}

/** An account as the Users screens show it (REQUIREMENTS §9 User, USR-02). */
export interface User {
  id: string;
  fullName: string;
  email: string;
  /** Stored as +237XXXXXXXXX (Q-57i); may be empty. */
  phones: string[];
  role: Role;
  status: RecordStatus;
  /** The depot they run: set only for an active depot manager (USR-03, Q-57c). */
  depot: UserDepotRef | null;
}

/** A quantity in one unit, as the person entered it (e.g. 45 Packs). */
export interface UnitQuantity {
  unit: Unit;
  quantity: number;
}

/** A quantity of one product in one unit, as entered (ADM-02). */
export interface ProductQuantity extends UnitQuantity {
  productId: string;
}

/** One row of the admin Collections list (ADM-03): who, when, status, and what was collected per product. */
export interface CollectionListItem {
  id: string;
  /** COL-00001 style (REQUIREMENTS §11). */
  label: string;
  /** UTC instant; shown in Douala time (NFR-10). */
  createdAt: string;
  distributorId: string;
  /** Null when the caller cannot read the distributor's profile. */
  distributorName: string | null;
  status: CollectionStatus;
  /** Per product and unit as entered, corrections applied. No remaining or handed-over figure on the list. */
  collected: ProductQuantity[];
}

/** One row of the admin Distributions list (ADM-04): a hand-over and its receipt status. */
export interface ReceiptListItem {
  id: string;
  /** DIS-00018 style (Q-39), the same for distributor, manager and admin. */
  label: string;
  createdAt: string;
  collectionId: string;
  collectionLabel: string | null;
  depotId: string;
  depotName: string | null;
  distributorId: string;
  distributorName: string | null;
  status: ReceiptStatus;
  /** When the depot confirmed, or null while Awaiting Confirmation. */
  confirmedAt: string | null;
  /** What the distributor handed over, per product and unit as entered. */
  recorded: ProductQuantity[];
}

/** A collection line with the value in force after any admin correction (COR-04). */
export interface CollectionLine {
  id: string;
  productId: string;
  unit: Unit;
  quantity: number;
  originalQuantity: number;
  isCorrected: boolean;
  loaves: number;
}

/** Everything the collection detail page shows (ADM-04). */
export interface CollectionDetail {
  collection: CollectionListItem;
  lines: CollectionLine[];
  /** The hand-overs from this collection, newest first, with their receipt status. */
  receipts: ReceiptListItem[];
}

/** One count entry by the depot manager, in the unit they counted (RCP-06). */
export interface CountEntry {
  unit: Unit;
  quantity: number;
  originalQuantity: number;
  isCorrected: boolean;
}

/** One line of a receipt: recorded, counted, and the difference in loaves (REC-02). */
export interface ReceiptLineDetail {
  itemId: string;
  productId: string;
  unit: Unit;
  recordedQuantity: number;
  originalRecordedQuantity: number;
  recordedIsCorrected: boolean;
  recordedLoaves: number;
  /** Null until the depot confirms. */
  counts: CountEntry[] | null;
  countedLoaves: number | null;
  differenceLoaves: number | null;
}

/** Everything the receipt detail page shows (RCP-02, RCP-10, COR-04). */
export interface ReceiptDetail {
  receipt: ReceiptListItem;
  lines: ReceiptLineDetail[];
  /** The manager's comment in force; null when none or not confirmed. */
  comment: string | null;
  commentIsCorrected: boolean;
}
