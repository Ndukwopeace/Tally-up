/**
 * OperationsService backed by Supabase (ARCHITECTURE §6.3).
 *
 * WHY:  The deployed admin screens read the collection and receipt views the A3a
 *       and A3b migrations created, which already apply corrections and compute
 *       Remaining and both statuses in loaves (REC-01, COL-08, RCP-11, COR-05).
 * HOW:  Lists read `v_collection_list` and `v_receipt_list`, newest first, with the
 *       filters as query conditions and one extra row to know whether "Load more"
 *       has anything left. Details read the row plus the views for lines, balances,
 *       counts and comments. Every row is Zod-checked (SEC-5). Date filters are
 *       Douala calendar days, turned into UTC instants by `dayRange`.
 * WHEN: Created by services/index.ts in Supabase mode.
 * SECURITY: Read-only. Row Level Security decides which rows come back, through the
 *       views (security invoker). Raw database messages never reach the screen.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/mini";

import { compareUnits } from "@/domain/units";
import { dayRange } from "@/lib/format";
import {
  OperationsError,
  PAGE_SIZE,
  type CollectionFilters,
  type OperationsService,
  type Page,
  type ReceiptFilters,
} from "@/services/interfaces/OperationsService";
import type {
  CollectionDetail,
  CollectionLine,
  CollectionListItem,
  CollectionProductBalance,
  CountEntry,
  ReceiptDetail,
  ReceiptLineDetail,
  ProductQuantity,
  ReceiptListItem,
} from "@/types/entities";
import { COLLECTION_STATUSES, RECEIPT_STATUSES, UNITS, type Unit } from "@/types/enums";

const productQuantities = z.array(
  z.object({ product_id: z.string(), unit: z.enum(UNITS), quantity: z.number() }),
);
const nullableText = z.nullable(z.string());

const collectionRow = z.object({
  id: z.string(),
  label: z.string(),
  created_at: z.string(),
  distributor_id: z.string(),
  distributor_name: nullableText,
  status: z.enum(COLLECTION_STATUSES),
  collected_lines: productQuantities,
});

const receiptRow = z.object({
  id: z.string(),
  label: z.string(),
  created_at: z.string(),
  collection_id: z.string(),
  collection_label: nullableText,
  depot_id: z.string(),
  depot_name: nullableText,
  distributor_id: z.string(),
  distributor_name: nullableText,
  status: z.enum(RECEIPT_STATUSES),
  confirmed_at: nullableText,
  recorded_lines: productQuantities,
});

const collectionLineRow = z.object({
  id: z.string(),
  product_id: z.string(),
  unit: z.enum(UNITS),
  quantity_original: z.number(),
  quantity_effective: z.number(),
  is_corrected: z.boolean(),
  loaves: z.number(),
});

const balanceRow = z.object({
  product_id: z.string(),
  collected_loaves: z.number(),
  distributed_loaves: z.number(),
  remaining_loaves: z.number(),
});

const itemRow = z.object({
  id: z.string(),
  product_id: z.string(),
  unit: z.enum(UNITS),
  quantity_original: z.number(),
  quantity_effective: z.number(),
  is_corrected: z.boolean(),
  loaves: z.number(),
});

const lineResultRow = z.object({
  distribution_item_id: z.string(),
  counted_loaves: z.nullable(z.number()),
  difference_loaves: z.nullable(z.number()),
});

const confirmationRow = z.object({
  id: z.string(),
  comment_effective: nullableText,
  is_corrected: z.boolean(),
});

const countRow = z.object({
  distribution_item_id: z.string(),
  unit: z.enum(UNITS),
  quantity_original: z.number(),
  quantity_effective: z.number(),
  is_corrected: z.boolean(),
});

// Parses every row of a list, or fails as "unavailable" (a row the app does not understand is never shown).
function parseRows<T>(schema: z.ZodMiniType<T>, rows: unknown): T[] {
  const parsed = z.array(schema).safeParse(rows);
  if (!parsed.success) {
    throw new OperationsError("unavailable");
  }
  return parsed.data;
}

function parseOne<T>(schema: z.ZodMiniType<T>, row: unknown): T | null {
  if (row === null) {
    return null;
  }
  const parsed = schema.safeParse(row);
  if (!parsed.success) {
    throw new OperationsError("unavailable");
  }
  return parsed.data;
}

function toProductQuantity(row: { product_id: string; unit: Unit; quantity: number }): ProductQuantity {
  return { productId: row.product_id, unit: row.unit, quantity: row.quantity };
}

function toCollection(row: z.infer<typeof collectionRow>): CollectionListItem {
  return {
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    distributorId: row.distributor_id,
    distributorName: row.distributor_name,
    status: row.status,
    collected: row.collected_lines.map(toProductQuantity),
  };
}

function toReceipt(row: z.infer<typeof receiptRow>): ReceiptListItem {
  return {
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    collectionId: row.collection_id,
    collectionLabel: row.collection_label,
    depotId: row.depot_id,
    depotName: row.depot_name,
    distributorId: row.distributor_id,
    distributorName: row.distributor_name,
    status: row.status,
    confirmedAt: row.confirmed_at,
    recorded: row.recorded_lines.map(toProductQuantity),
  };
}

export class SupabaseOperationsService implements OperationsService {
  constructor(private readonly client: SupabaseClient) {}

  async listCollections(filters: CollectionFilters, offset: number): Promise<Page<CollectionListItem>> {
    let query = this.client.from("v_collection_list").select("*");
    // RULE Q-59g: filters by Douala day, distributor and status.
    if (filters.from !== undefined) {
      query = query.gte("created_at", dayRange(filters.from).from);
    }
    if (filters.to !== undefined) {
      query = query.lt("created_at", dayRange(filters.to).to);
    }
    if (filters.distributorId !== undefined) {
      query = query.eq("distributor_id", filters.distributorId);
    }
    if (filters.status !== undefined) {
      query = query.eq("status", filters.status);
    }
    const result = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PAGE_SIZE);
    return pageOf(result, collectionRow, toCollection);
  }

  async listReceipts(filters: ReceiptFilters, offset: number): Promise<Page<ReceiptListItem>> {
    let query = this.client.from("v_receipt_list").select("*");
    // RULE Q-59g: filters by Douala day, depot and receipt status.
    if (filters.from !== undefined) {
      query = query.gte("created_at", dayRange(filters.from).from);
    }
    if (filters.to !== undefined) {
      query = query.lt("created_at", dayRange(filters.to).to);
    }
    if (filters.depotId !== undefined) {
      query = query.eq("depot_id", filters.depotId);
    }
    if (filters.status !== undefined) {
      query = query.eq("status", filters.status);
    }
    const result = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PAGE_SIZE);
    return pageOf(result, receiptRow, toReceipt);
  }

  async getCollection(id: string): Promise<CollectionDetail | null> {
    const [head, lines, balances, receipts] = await Promise.all([
      this.client.from("v_collection_list").select("*").eq("id", id).maybeSingle(),
      this.client.from("v_collection_items_effective").select("*").eq("collection_id", id),
      this.client.from("v_collection_product_balance").select("*").eq("collection_id", id),
      this.client
        .from("v_receipt_list")
        .select("*")
        .eq("collection_id", id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }),
    ]);
    if (head.error || lines.error || balances.error || receipts.error) {
      throw new OperationsError("unavailable");
    }
    const collection = parseOne(collectionRow, head.data);
    if (collection === null) {
      return null;
    }
    return {
      collection: toCollection(collection),
      lines: parseRows(collectionLineRow, lines.data)
        .map((row): CollectionLine => ({
          id: row.id,
          productId: row.product_id,
          unit: row.unit,
          quantity: row.quantity_effective,
          originalQuantity: row.quantity_original,
          isCorrected: row.is_corrected,
          loaves: row.loaves,
        }))
        .sort(compareUnits),
      balances: parseRows(balanceRow, balances.data).map((row): CollectionProductBalance => ({
        productId: row.product_id,
        collectedLoaves: row.collected_loaves,
        distributedLoaves: row.distributed_loaves,
        remainingLoaves: row.remaining_loaves,
      })),
      receipts: parseRows(receiptRow, receipts.data).map(toReceipt),
    };
  }

  async getReceipt(id: string): Promise<ReceiptDetail | null> {
    const [head, items, results, confirmation] = await Promise.all([
      this.client.from("v_receipt_list").select("*").eq("id", id).maybeSingle(),
      this.client.from("v_distribution_items_effective").select("*").eq("distribution_id", id),
      this.client
        .from("v_receipt_line")
        .select("distribution_item_id, counted_loaves, difference_loaves")
        .eq("distribution_id", id),
      this.client
        .from("v_confirmations_effective")
        .select("id, comment_effective, is_corrected")
        .eq("distribution_id", id)
        .maybeSingle(),
    ]);
    if (head.error || items.error || results.error || confirmation.error) {
      throw new OperationsError("unavailable");
    }
    const receipt = parseOne(receiptRow, head.data);
    if (receipt === null) {
      return null;
    }
    const confirmed = parseOne(confirmationRow, confirmation.data);
    const counts = confirmed === null ? [] : await this.counts(confirmed.id);
    const outcomes = new Map(
      parseRows(lineResultRow, results.data).map((row) => [row.distribution_item_id, row]),
    );
    const lines = parseRows(itemRow, items.data)
      .map((row): ReceiptLineDetail => {
        const outcome = outcomes.get(row.id);
        return {
          itemId: row.id,
          productId: row.product_id,
          unit: row.unit,
          recordedQuantity: row.quantity_effective,
          originalRecordedQuantity: row.quantity_original,
          recordedIsCorrected: row.is_corrected,
          recordedLoaves: row.loaves,
          counts:
            confirmed === null
              ? null
              : counts
                  .filter((count) => count.distribution_item_id === row.id)
                  .map((count): CountEntry => ({
                    unit: count.unit,
                    quantity: count.quantity_effective,
                    originalQuantity: count.quantity_original,
                    isCorrected: count.is_corrected,
                  }))
                  .sort(compareUnits),
          countedLoaves: outcome?.counted_loaves ?? null,
          differenceLoaves: outcome?.difference_loaves ?? null,
        };
      })
      .sort(compareUnits);
    return {
      receipt: toReceipt(receipt),
      lines,
      comment: confirmed?.comment_effective ?? null,
      commentIsCorrected: confirmed?.is_corrected ?? false,
    };
  }

  // The depot manager's count entries (corrections applied) for one confirmation.
  private async counts(confirmationId: string) {
    const { data, error } = await this.client
      .from("v_confirmation_counts_effective")
      .select("*")
      .eq("confirmation_id", confirmationId);
    if (error) {
      throw new OperationsError("unavailable");
    }
    return parseRows(countRow, data);
  }
}

// One page: the query asked for one row more than a page, to know whether "Load more" has anything left.
function pageOf<Row, Item>(
  result: { data: unknown; error: unknown },
  schema: z.ZodMiniType<Row>,
  convert: (row: Row) => Item,
): Page<Item> {
  if (result.error) {
    throw new OperationsError("unavailable");
  }
  const rows = parseRows(schema, result.data);
  return { rows: rows.slice(0, PAGE_SIZE).map(convert), hasMore: rows.length > PAGE_SIZE };
}
