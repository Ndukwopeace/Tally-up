/**
 * What the admin monitoring screens need from the backend (ARCHITECTURE §3.1, ADM-02 to ADM-04).
 *
 * WHY:  Pages and hooks must not depend on Supabase directly (NFR-03); tests use
 *       services/mock/MockOperationsService.ts behind the same interface.
 * HOW:  Read-only. `listCollections` and `listReceipts` return one page of rows,
 *       newest first, filtered (Q-59g); `getCollection` and `getReceipt` return
 *       everything one detail page shows, or null when the record does not exist
 *       or is not visible. Dates in filters are Douala calendar days
 *       ("YYYY-MM-DD", inclusive). Failures throw `OperationsError`.
 * WHEN: Created at start-up (services/index.ts), used by hooks/useOperations.ts.
 * SECURITY: Row Level Security decides which rows come back; nothing here writes.
 */
import type { CollectionDetail, CollectionListItem, ReceiptDetail, ReceiptListItem } from "@/types/entities";
import type { CollectionStatus, ReceiptStatus } from "@/types/enums";

/** RULE AD-2 / Q-59g: lists load 25 rows at a time. */
export const PAGE_SIZE = 25;

export const OPERATIONS_ERROR_CODES = [
  // Network down or an unexpected answer.
  "unavailable",
] as const;
export type OperationsErrorCode = (typeof OPERATIONS_ERROR_CODES)[number];

export class OperationsError extends Error {
  readonly code: OperationsErrorCode;

  constructor(code: OperationsErrorCode) {
    super(code);
    this.name = "OperationsError";
    this.code = code;
  }
}

/** Q-59g: Collections can be filtered by date, distributor and status. */
export interface CollectionFilters {
  /** First Douala day, "YYYY-MM-DD", inclusive. */
  from?: string;
  /** Last Douala day, inclusive. */
  to?: string;
  distributorId?: string;
  status?: CollectionStatus;
}

/** Q-59g: Distributions can be filtered by date, depot and receipt status (which includes "with discrepancy"). */
export interface ReceiptFilters {
  from?: string;
  to?: string;
  depotId?: string;
  status?: ReceiptStatus;
}

/** One page of a list. `hasMore` says whether "Load more" has anything to load. */
export interface Page<T> {
  rows: T[];
  hasMore: boolean;
}

export interface OperationsService {
  listCollections(filters: CollectionFilters, offset: number): Promise<Page<CollectionListItem>>;
  getCollection(id: string): Promise<CollectionDetail | null>;
  listReceipts(filters: ReceiptFilters, offset: number): Promise<Page<ReceiptListItem>>;
  getReceipt(id: string): Promise<ReceiptDetail | null>;
}
