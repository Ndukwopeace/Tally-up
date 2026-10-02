/**
 * ProductService backed by Supabase (ARCHITECTURE §6).
 *
 * WHY:  The deployed app stores products in Postgres, shared by every phone.
 * HOW:  Reads `products` with their `product_units` in one request and turns
 *       the rows into `Product` (Zod-checked, SEC-5). Saves through the
 *       database function `admin_save_product`, the only write path.
 * WHEN: Created by services/index.ts in Supabase mode.
 * SECURITY: RLS decides which rows come back; the save function refuses
 *       anyone but an active admin. Raw database messages never reach the screen.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/mini";

import type { ProductSaveInput } from "@/domain/products";
import { ProductError, type ProductService } from "@/services/interfaces/ProductService";
import type { Product } from "@/types/entities";
import { RECORD_STATUSES, UNITS } from "@/types/enums";

const SELECT = "id, name, code, description, status, product_units (unit, loaves_per_unit)";

const rowSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  // RULE Q-57j: optional; stored as null when empty.
  description: z.nullable(z.string()),
  status: z.enum(RECORD_STATUSES),
  product_units: z.array(z.object({ unit: z.enum(UNITS), loaves_per_unit: z.number() })),
});

// One database row (product + units) → Product. Loaf is implied (always 1).
function toProduct(raw: unknown): Product {
  const parsed = rowSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ProductError("unavailable");
  }
  const row = parsed.data;
  const loavesOf = (unit: "Pack" | "Caisse") =>
    row.product_units.find((candidate) => candidate.unit === unit)?.loaves_per_unit ?? null;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description ?? "",
    status: row.status,
    packLoaves: loavesOf("Pack"),
    caisseLoaves: loavesOf("Caisse"),
  };
}

// Error messages raised by admin_save_product → codes.
const SAVE_ERRORS: Record<string, ProductError["code"]> = {
  CODE_TAKEN: "code_taken",
  INVALID_PRODUCT: "invalid",
  NOT_FOUND: "not_found",
  NOT_ADMIN: "not_admin",
};

export class SupabaseProductService implements ProductService {
  constructor(private readonly client: SupabaseClient) {}

  async list(): Promise<Product[]> {
    const { data, error } = await this.client.from("products").select(SELECT).order("name");
    if (error) {
      throw new ProductError("unavailable");
    }
    return data.map(toProduct);
  }

  async get(id: string): Promise<Product | null> {
    const { data, error } = await this.client.from("products").select(SELECT).eq("id", id).maybeSingle();
    if (error) {
      throw new ProductError("unavailable");
    }
    return data === null ? null : toProduct(data);
  }

  async save(input: ProductSaveInput, id?: string): Promise<string> {
    const result = await this.client.rpc("admin_save_product", {
      target_product_id: id ?? null,
      product_name: input.name,
      product_code: input.code,
      product_description: input.description,
      product_status: input.status,
      pack_loaves: input.packLoaves,
      caisse_loaves: input.caisseLoaves,
    });
    // The client is untyped (no generated database types), so the answer is checked here.
    const data: unknown = result.data;
    if (result.error) {
      throw new ProductError(SAVE_ERRORS[result.error.message] ?? "unavailable");
    }
    if (typeof data !== "string") {
      throw new ProductError("unavailable");
    }
    return data;
  }
}
