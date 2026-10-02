/**
 * What the app needs from a depot backend (ARCHITECTURE §3.1, DEP-01 to DEP-03).
 *
 * WHY:  Pages and hooks must not depend on Supabase directly (NFR-03); tests
 *       use services/mock/MockDepotService.ts behind the same interface.
 * HOW:  `list` / `get` read depots with their active manager; `listManagers`
 *       reads the depot manager accounts for the manager picker; `save`
 *       creates (no id) or edits a depot and optionally assigns a manager.
 *       Failures throw `DepotError` with a code the screen turns into words.
 * WHEN: Created at start-up (services/index.ts), used by hooks/useDepots.ts.
 * SECURITY: RLS and admin_save_depot() decide who sees and changes what.
 */
import type { DepotSaveInput } from "@/domain/depots";
import type { Depot, ManagerOption } from "@/types/entities";

export const DEPOT_ERROR_CODES = [
  // The database refused the values (should not happen after form checks).
  "invalid",
  // The depot was not found (e.g. a stale link).
  "not_found",
  // The chosen account is not a depot manager.
  "not_a_manager",
  // The caller is not an active admin.
  "not_admin",
  // Network down or an unexpected answer.
  "unavailable",
] as const;
export type DepotErrorCode = (typeof DEPOT_ERROR_CODES)[number];

export class DepotError extends Error {
  readonly code: DepotErrorCode;

  constructor(code: DepotErrorCode) {
    super(code);
    this.name = "DepotError";
    this.code = code;
  }
}

export interface DepotService {
  /** Every depot the caller may see, by name. */
  list(): Promise<Depot[]>;
  /** One depot, or null when it does not exist or is not visible. */
  get(id: string): Promise<Depot | null>;
  /** Depot manager accounts, by name, for the manager picker. */
  listManagers(): Promise<ManagerOption[]>;
  /** Creates (`id` undefined) or edits a depot; returns its id. */
  save(input: DepotSaveInput, id?: string): Promise<string>;
}
