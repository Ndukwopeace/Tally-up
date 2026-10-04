/**
 * The queries behind the admin Home (ADM-01, ADM-02, ADM-03, ADM-06, Q-59c to Q-59f).
 *
 * WHY:  Home needs a handful of numbers and short lists. The views already apply
 *       corrections and compute statuses (COR-05, COL-08, RCP-11), so Home reads
 *       them instead of repeating any rule, and the numbers cannot disagree with
 *       the Collections and Distributions lists.
 * HOW:  One round of parallel reads:
 *       - today's collections and today's hand-overs (Douala day), summed per
 *         unit as entered in TypeScript (`sumUnits`, ADM-02);
 *       - the loaves still to hand over, per product (REC-01);
 *       - exact counts of receipts Awaiting Confirmation, Confirmed today and
 *         Confirmed with Discrepancy (the first and last count all open items);
 *       - the 5 latest discrepancies;
 *       - the oldest few In Progress collections and Awaiting receipts past the
 *         24-hour limits (`staleCollectionHours`, `agedReceiptHours`), with how many.
 *       Any failed read fails the whole call as "unavailable".
 * WHEN: Called by SupabaseOperationsService.getHome.
 * SECURITY: Read-only; Row Level Security decides what comes back (views are security invoker).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/mini";

import { collectionRow, parseRows, receiptRow, toCollection, toReceipt } from "./operationsRows";

import { BUSINESS_RULES } from "@/config/business-rules";
import { sumUnits } from "@/domain/units";
import { businessDay, dayRange } from "@/lib/format";
import { HOME_LIST_SIZE, OperationsError } from "@/services/interfaces/OperationsService";
import type { HomeData } from "@/types/entities";

const HOUR_MS = 3_600_000;
const balanceRow = z.object({ product_id: z.string(), remaining_loaves: z.number() });

interface Result {
  data: unknown;
  error: unknown;
  count?: number | null;
}

// A read that failed or an answer without a count is "unavailable", never a guess.
function checked(result: Result): Result {
  if (result.error) {
    throw new OperationsError("unavailable");
  }
  return result;
}

function countOf(result: Result): number {
  const { count } = checked(result);
  if (typeof count !== "number") {
    throw new OperationsError("unavailable");
  }
  return count;
}

// RULE REC-01: per product, loaves still to hand over, summed over every collection.
function remainingByProduct(data: unknown): HomeData["remaining"] {
  const totals = new Map<string, number>();
  for (const row of parseRows(balanceRow, data)) {
    totals.set(row.product_id, (totals.get(row.product_id) ?? 0) + row.remaining_loaves);
  }
  return [...totals.entries()].map(([productId, remainingLoaves]) => ({ productId, remainingLoaves }));
}

export async function loadHome(client: SupabaseClient, now: Date): Promise<HomeData> {
  const { from, to } = dayRange(businessDay(now));
  const staleBefore = new Date(now.getTime() - BUSINESS_RULES.staleCollectionHours * HOUR_MS).toISOString();
  const agedBefore = new Date(now.getTime() - BUSINESS_RULES.agedReceiptHours * HOUR_MS).toISOString();
  const receipts = () => client.from("v_receipt_list");
  const countOnly = { count: "exact", head: true } as const;
  const lastFew = { ascending: false } as const;

  const [
    todayCollections,
    todayReceipts,
    balances,
    awaiting,
    discrepancies,
    confirmedToday,
    latest,
    stale,
    aged,
  ] = await Promise.all([
    client
      .from("v_collection_list")
      .select("*")
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", lastFew)
      .order("id", lastFew),
    receipts().select("*").gte("created_at", from).lt("created_at", to),
    client
      .from("v_collection_product_balance")
      .select("product_id, remaining_loaves")
      .gt("remaining_loaves", 0),
    receipts().select("id", countOnly).eq("status", "awaiting_confirmation"),
    receipts().select("id", countOnly).eq("status", "confirmed_with_discrepancy"),
    receipts()
      .select("id", countOnly)
      .eq("status", "confirmed")
      .gte("confirmed_at", from)
      .lt("confirmed_at", to),
    receipts()
      .select("*")
      .eq("status", "confirmed_with_discrepancy")
      .order("created_at", lastFew)
      .order("id", lastFew)
      .range(0, HOME_LIST_SIZE - 1),
    client
      .from("v_collection_list")
      .select("*", { count: "exact" })
      .eq("status", "in_progress")
      .lt("created_at", staleBefore)
      .order("created_at", { ascending: true })
      .range(0, HOME_LIST_SIZE - 1),
    receipts()
      .select("*", { count: "exact" })
      .eq("status", "awaiting_confirmation")
      .lt("created_at", agedBefore)
      .order("created_at", { ascending: true })
      .range(0, HOME_LIST_SIZE - 1),
  ]);

  const collections = parseRows(collectionRow, checked(todayCollections).data).map(toCollection);
  const handedOver = parseRows(receiptRow, checked(todayReceipts).data).map(toReceipt);
  return {
    collectedToday: sumUnits(collections.flatMap((c) => c.collected)),
    distributedToday: sumUnits(handedOver.flatMap((r) => r.recorded)),
    remaining: remainingByProduct(checked(balances).data),
    awaitingCount: countOf(awaiting),
    discrepancyCount: countOf(discrepancies),
    confirmedTodayCount: countOf(confirmedToday),
    todayCollections: collections,
    latestDiscrepancies: parseRows(receiptRow, checked(latest).data).map(toReceipt),
    staleCollections: {
      count: countOf(stale),
      rows: parseRows(collectionRow, stale.data).map(toCollection),
    },
    agedReceipts: { count: countOf(aged), rows: parseRows(receiptRow, aged.data).map(toReceipt) },
  };
}
