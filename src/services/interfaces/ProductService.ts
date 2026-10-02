/**
 * What the app needs from a product backend (ARCHITECTURE §3.1, PRD-01 to PRD-07).
 *
 * WHY:  Pages and hooks must not depend on Supabase directly (NFR-03); tests
 *       use services/mock/MockProductService.ts behind the same interface.
 * HOW:  `list` and `get` read; `save` creates (no id) or edits a product and
 *       its units in one step. Failures throw `ProductError` with a code the
 *       screen turns into words (ARCHITECTURE §13).
 * WHEN: Created at start-up (services/index.ts), used by hooks/useProducts.ts.
 * SECURITY: Which products a caller sees and who may save is decided by RLS
 *       and admin_save_product() in the database, not here.
 */
import type { ProductSaveInput } from "@/domain/products";
import type { Product } from "@/types/entities";

export const PRODUCT_ERROR_CODES = [
  // Another product already uses this code (Q-57h).
  "code_taken",
  // The database refused the values (should not happen after form checks).
  "invalid",
  // The product was not found (e.g. a stale link).
  "not_found",
  // The caller is not an active admin.
  "not_admin",
  // Network down or an unexpected answer.
  "unavailable",
] as const;
export type ProductErrorCode = (typeof PRODUCT_ERROR_CODES)[number];

export class ProductError extends Error {
  readonly code: ProductErrorCode;

  constructor(code: ProductErrorCode) {
    super(code);
    this.name = "ProductError";
    this.code = code;
  }
}

export interface ProductService {
  /** Every product the caller may see, by name. */
  list(): Promise<Product[]>;
  /** One product, or null when it does not exist or is not visible. */
  get(id: string): Promise<Product | null>;
  /** Creates (`id` undefined) or edits a product; returns its id. */
  save(input: ProductSaveInput, id?: string): Promise<string>;
}
