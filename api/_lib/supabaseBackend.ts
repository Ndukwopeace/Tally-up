/**
 * The real AdminBackend: Supabase Auth and the database, with the service-role key.
 *
 * WHY:  adminUsers.ts holds the decisions; this file holds the calls that need
 *       the secret key (create a login, set an email or password) and the two
 *       database functions that only the service role may run (A2c migrations).
 * HOW:  `createSupabaseBackend` wraps a Supabase client. `backendFromEnv` builds
 *       that client from the Vercel environment (SUPABASE_URL and
 *       SUPABASE_SERVICE_ROLE_KEY) and returns null when either is missing.
 *       Supabase and database error codes are turned into the short codes the
 *       app understands; raw messages never leave this file.
 * WHEN: Created per request by the route files under api/admin/users/.
 * SECURITY: SEC-4: this is one of the only places the service-role key exists,
 *       and it exists only in the Vercel Functions' server environment. The
 *       client does not keep a session (nothing is stored between requests).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/mini";

import type { AdminBackend, SaveUserArgs, UserApiError } from "./adminUsers.js";

// Error codes Supabase Auth gives for the cases the admin can fix.
const AUTH_ERRORS: Record<string, UserApiError> = {
  email_exists: "email_taken",
  user_already_exists: "email_taken",
  weak_password: "weak_password",
  user_not_found: "not_found",
  email_address_invalid: "invalid",
  validation_failed: "invalid",
};

// Messages raised by the A2c database functions.
const DATABASE_ERRORS: Record<string, UserApiError> = {
  NOT_ADMIN: "not_admin",
  NOT_FOUND: "not_found",
  INVALID_USER: "invalid",
  NOT_A_MANAGER: "invalid",
  DEPOT_REQUIRED: "depot_required",
  CANNOT_DEACTIVATE_SELF: "cannot_deactivate_self",
  LAST_ADMIN: "last_admin",
  EMAIL_TAKEN: "email_taken",
};

// The one column read by getProfileEmail; the client has no generated types, so rows are checked here (SEC-5).
const emailRow = z.object({ email: z.string() });

function fromAuthError(error: { code?: string }): UserApiError {
  return (error.code && AUTH_ERRORS[error.code]) || "unavailable";
}

function fromDatabaseError(error: { message: string }): UserApiError {
  return DATABASE_ERRORS[error.message] ?? "unavailable";
}

export function createSupabaseBackend(client: SupabaseClient): AdminBackend {
  return {
    async getUserId(token) {
      // SECURITY: Supabase checks the token's signature and expiry; we only read the id it returns.
      const { data, error } = await client.auth.getUser(token);
      return error ? null : data.user.id;
    },

    async isActiveAdmin(id) {
      const { data, error } = await client
        .from("profiles")
        .select("id")
        .eq("id", id)
        .eq("role", "admin")
        .eq("status", "active")
        .maybeSingle();
      if (error) {
        throw new Error("profile lookup failed");
      }
      return data !== null;
    },

    async getProfileEmail(id) {
      const { data, error } = await client.from("profiles").select("email").eq("id", id).maybeSingle();
      if (error) {
        throw new Error("profile lookup failed");
      }
      const row = emailRow.safeParse(data);
      return row.success ? row.data.email : null;
    },

    async createAuthUser(email, password) {
      // email_confirm: the admin vouches for the address, so no confirmation email is needed (Q-57a).
      const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true });
      return error ? { error: fromAuthError(error) } : { id: data.user.id };
    },

    async setAuthEmail(id, email) {
      const { error } = await client.auth.admin.updateUserById(id, { email, email_confirm: true });
      return error ? fromAuthError(error) : null;
    },

    async setAuthPassword(id, password) {
      const { error } = await client.auth.admin.updateUserById(id, { password });
      return error ? fromAuthError(error) : null;
    },

    async deleteAuthUser(id) {
      // Best effort: if this fails the login exists without a profile and cannot sign in (AUTH-09).
      await client.auth.admin.deleteUser(id);
    },

    async saveUser(args: SaveUserArgs) {
      const { error } = await client.rpc("admin_save_user", {
        acting_admin: args.actingAdmin,
        target: args.target,
        user_name: args.fullName,
        user_email: args.email,
        user_phones: args.phones,
        user_role: args.role,
        user_status: args.status,
        user_depot: args.depotId,
        is_new: args.isNew,
      });
      return error ? fromDatabaseError(error) : null;
    },

    async recordPasswordReset(actingAdmin, target) {
      const { error } = await client.rpc("admin_record_password_reset", {
        acting_admin: actingAdmin,
        target,
      });
      return error ? fromDatabaseError(error) : null;
    },
  };
}

/**
 * The backend for this server, or null when the server has no database settings.
 * Reads the names the Vercel Supabase integration creates (ARCHITECTURE §15).
 */
export function backendFromEnv(env: Readonly<Record<string, string | undefined>>): AdminBackend | null {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  // SECURITY: SEC-4: read only on the server, never exposed under a NEXT_PUBLIC_ or VITE_ name.
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) {
    return null;
  }
  // A server has no browser address to read a session from, and keeps no session between requests.
  const client = createClient(url.trim(), key.trim(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return createSupabaseBackend(client);
}
