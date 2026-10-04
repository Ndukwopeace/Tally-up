/**
 * Row shapes and converters for the Supabase OperationsService (ARCHITECTURE §6.3).
 *
 * WHY:  Every row the database sends is checked before the app uses it (SEC-5), and
 *       turned into the camelCase types the screens use. The detail pages and Home
 *       both need the same checks, so they live in one place.
 * HOW:  Zod schemas per view row, `parseRows` / `parseOne` that fail as
 *       "unavailable" when a row is not understood, and `to*` converters.
 * WHEN: Used by SupabaseOperationsService and SupabaseHomeQueries.
 * SECURITY: A row the app does not understand is never shown (SEC-5).
 */
import { z } from "zod/mini";

import { OperationsError } from "@/services/interfaces/OperationsService";
import type { CollectionListItem, ProductQuantity, ReceiptListItem } from "@/types/entities";
import { COLLECTION_STATUSES, RECEIPT_STATUSES, UNITS, type Unit } from "@/types/enums";

export const productQuantities = z.array(
  z.object({ product_id: z.string(), unit: z.enum(UNITS), quantity: z.number() }),
);
export const nullableText = z.nullable(z.string());

export const collectionRow = z.object({
  id: z.string(),
  label: z.string(),
  created_at: z.string(),
  distributor_id: z.string(),
  distributor_name: nullableText,
  status: z.enum(COLLECTION_STATUSES),
  collected_lines: productQuantities,
});

export const receiptRow = z.object({
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

export const collectionLineRow = z.object({
  id: z.string(),
  product_id: z.string(),
  unit: z.enum(UNITS),
  quantity_original: z.number(),
  quantity_effective: z.number(),
  is_corrected: z.boolean(),
  loaves: z.number(),
});

export const itemRow = z.object({
  id: z.string(),
  product_id: z.string(),
  unit: z.enum(UNITS),
  quantity_original: z.number(),
  quantity_effective: z.number(),
  is_corrected: z.boolean(),
  loaves: z.number(),
});

export const lineResultRow = z.object({
  distribution_item_id: z.string(),
  counted_loaves: z.nullable(z.number()),
  difference_loaves: z.nullable(z.number()),
});

export const confirmationRow = z.object({
  id: z.string(),
  comment_effective: nullableText,
  is_corrected: z.boolean(),
});

export const countRow = z.object({
  distribution_item_id: z.string(),
  unit: z.enum(UNITS),
  quantity_original: z.number(),
  quantity_effective: z.number(),
  is_corrected: z.boolean(),
});

// Parses every row of a list, or fails as "unavailable" (a row the app does not understand is never shown).
export function parseRows<T>(schema: z.ZodMiniType<T>, rows: unknown): T[] {
  const parsed = z.array(schema).safeParse(rows);
  if (!parsed.success) {
    throw new OperationsError("unavailable");
  }
  return parsed.data;
}

export function parseOne<T>(schema: z.ZodMiniType<T>, row: unknown): T | null {
  if (row === null) {
    return null;
  }
  const parsed = schema.safeParse(row);
  if (!parsed.success) {
    throw new OperationsError("unavailable");
  }
  return parsed.data;
}

export function toProductQuantity(row: {
  product_id: string;
  unit: Unit;
  quantity: number;
}): ProductQuantity {
  return { productId: row.product_id, unit: row.unit, quantity: row.quantity };
}

export function toCollection(row: z.infer<typeof collectionRow>): CollectionListItem {
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

export function toReceipt(row: z.infer<typeof receiptRow>): ReceiptListItem {
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
