/**
 * What the app needs from a user-account backend (ARCHITECTURE §3.1, USR-01 to USR-06).
 *
 * WHY:  Pages and hooks must not depend on Supabase or on the Vercel Functions
 *       directly (NFR-03); tests use services/mock/MockUserService.ts behind the
 *       same interface.
 * HOW:  `list` / `get` read accounts with the depot they run; `create`, `update`
 *       and `resetPassword` change them through the admin endpoints. Failures
 *       throw `UserError` with a code the screen turns into words.
 * WHEN: Created at start-up (services/index.ts), used by hooks/useUsers.ts.
 * SECURITY: RLS decides who reads accounts. Writes need Supabase's secret server key,
 *       which exists only in the Vercel Functions, so the browser asks the
 *       server (api/admin/users*), which checks the caller is an active admin.
 */
import type { UserSaveInput } from "@/domain/users";
import type { User } from "@/types/entities";

export const USER_ERROR_CODES = [
  // No signed-in session, or it was not accepted (e.g. it expired).
  "unauthenticated",
  // The caller is not an active admin.
  "not_admin",
  // The values were refused (should not happen after form checks).
  "invalid",
  // The account was not found (e.g. a stale link).
  "not_found",
  // Another account already uses this email (USR-02).
  "email_taken",
  // Supabase refused the password as too weak.
  "weak_password",
  // USR-06 / Q-57f: an admin cannot deactivate themselves.
  "cannot_deactivate_self",
  // USR-06 / Q-57f: the last active admin stays an admin.
  "last_admin",
  // USR-03 / Q-57c: an active depot manager needs a depot.
  "depot_required",
  // Network down or an unexpected answer.
  "unavailable",
] as const;
export type UserErrorCode = (typeof USER_ERROR_CODES)[number];

export class UserError extends Error {
  readonly code: UserErrorCode;

  constructor(code: UserErrorCode) {
    super(code);
    this.name = "UserError";
    this.code = code;
  }
}

export interface UserService {
  /** Every account, by name. */
  list(): Promise<User[]>;
  /** One account, or null when it does not exist or is not visible. */
  get(id: string): Promise<User | null>;
  /** Q-57a: creates an account with the temporary password the admin typed; returns its id. */
  create(input: UserSaveInput, password: string): Promise<string>;
  /** Edits an account, including its email and role (Q-57g) and Active (USR-01); returns its id. */
  update(id: string, input: UserSaveInput): Promise<string>;
  /** Q-57b: sets a new temporary password typed by the admin. */
  resetPassword(id: string, password: string): Promise<void>;
}
