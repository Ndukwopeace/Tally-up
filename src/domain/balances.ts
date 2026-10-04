/**
 * Collection balances, receipt differences and the two computed statuses
 * (REC-01, REC-02, REC-04, COL-08, RCP-06, RCP-11).
 *
 * WHY:  Remaining, Difference and both statuses are computed, never stored, so
 *       they cannot drift out of step with the records (REQUIREMENTS §9).
 * HOW:  Pure functions over lines that already carry the values in force (after
 *       any admin correction, COR-05). Everything is in loaves, per product:
 *       totals across products are never used (REC-04). The SQL views
 *       v_collection_product_balance, v_receipt_line and v_receipt_status do the
 *       same sums; the same test cases run against both.
 * WHEN: The mock services and the screens' live totals; the database views are the
 *       source of truth for stored data.
 * SECURITY: No I/O; converts with `toLoaves`, which rejects fractions and negatives.
 */
import { toLoaves } from "./units";

import type { CollectionStatus, ReceiptStatus } from "@/types/enums";

/** A recorded line: a quantity in some unit, with the loaves-per-unit frozen at submit. */
export interface QuantityLine {
  productId: string;
  quantity: number;
  loavesPerUnitSnapshot: number;
}

/** One product's balance within a collection, in loaves (REC-01). */
export interface ProductBalance {
  productId: string;
  collectedLoaves: number;
  distributedLoaves: number;
  remainingLoaves: number;
}

// Total loaves per product, keeping the order products first appear in.
function loavesByProduct(lines: readonly QuantityLine[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of lines) {
    totals.set(
      line.productId,
      (totals.get(line.productId) ?? 0) + toLoaves(line.quantity, line.loavesPerUnitSnapshot),
    );
  }
  return totals;
}

/** RULE REC-01 / REC-04: per product, Collected = Distributed + Remaining, in loaves. */
export function collectionBalances(
  collected: readonly QuantityLine[],
  distributed: readonly QuantityLine[],
): ProductBalance[] {
  const given = loavesByProduct(distributed);
  return [...loavesByProduct(collected)].map(([productId, collectedLoaves]) => {
    const distributedLoaves = given.get(productId) ?? 0;
    return {
      productId,
      collectedLoaves,
      distributedLoaves,
      remainingLoaves: collectedLoaves - distributedLoaves,
    };
  });
}

/** RULE COL-08: In Progress while any product has loaves remaining, otherwise Fully Distributed. */
export function collectionStatus(balances: readonly ProductBalance[]): CollectionStatus {
  return balances.some((balance) => balance.remainingLoaves > 0) ? "in_progress" : "fully_distributed";
}

/** One receipt line after counting (REC-02). */
export interface ReceiptLine {
  recordedLoaves: number;
  countedLoaves: number;
  differenceLoaves: number;
}

/**
 * RULE REC-02 / RCP-06: Difference = Counted - Recorded, in loaves. The count may
 * be several entries in different units (e.g. 2 Caisse + 5 Packs); they are added up.
 */
export function receiptLine(
  recordedLoaves: number,
  counts: readonly Pick<QuantityLine, "quantity" | "loavesPerUnitSnapshot">[],
): ReceiptLine {
  const countedLoaves = counts.reduce(
    (sum, count) => sum + toLoaves(count.quantity, count.loavesPerUnitSnapshot),
    0,
  );
  return { recordedLoaves, countedLoaves, differenceLoaves: countedLoaves - recordedLoaves };
}

/**
 * RULE RCP-11: Awaiting Confirmation until the depot confirms; then Confirmed if
 * every line matches in loaves, otherwise Confirmed with Discrepancy.
 */
export function receiptStatus(lines: readonly ReceiptLine[], confirmed: boolean): ReceiptStatus {
  if (!confirmed) {
    return "awaiting_confirmation";
  }
  return lines.some((line) => line.differenceLoaves !== 0) ? "confirmed_with_discrepancy" : "confirmed";
}
