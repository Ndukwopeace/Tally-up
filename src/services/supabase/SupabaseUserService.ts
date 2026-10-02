/**
 * UserService backed by Supabase and the admin endpoints (ARCHITECTURE §6.6).
 *
 * WHY:  Accounts live in Supabase. Reading them is plain RLS-protected data
 *       access, but creating a login or setting a password needs
 *       Supabase's secret server key, which must never reach the browser (SEC-4).
 * HOW:  Reads `profiles` (with the depot each manager runs) through the Supabase
 *       client; rows are Zod-checked (SEC-5). Writes call the Vercel Functions
 *       under /api/admin/users with the signed-in admin's access token. The
 *       answer is `{ id }`, `{ ok }` or `{ error: "<code>" }`; anything else is
 *       "unavailable". Raw server messages never reach the screen.
 * WHEN: Created by services/index.ts in Supabase mode.
 * SECURITY: RLS decides which rows come back; the server function checks that
 *       the token belongs to an active admin before it does anything, and the
 *       database checks the rules again. This file never sees the secret server key.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/mini";

import type { UserSaveInput } from "@/domain/users";
import { UserError, USER_ERROR_CODES, type UserService } from "@/services/interfaces/UserService";
import type { User } from "@/types/entities";
import { RECORD_STATUSES, ROLES } from "@/types/enums";

const USER_SELECT = "id, full_name, email, phones, role, status, depots (id, name)";
const USERS_PATH = "/api/admin/users";

const userRowSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  email: z.string(),
  phones: z.array(z.string()),
  role: z.enum(ROLES),
  status: z.enum(RECORD_STATUSES),
  // Many-to-one: the depot this account runs, or null.
  depots: z.nullable(z.object({ id: z.string(), name: z.string() })),
});

// The function answers { id }, { ok: true } or { error: "<code>" }.
const answerSchema = z.object({
  id: z.optional(z.string()),
  ok: z.optional(z.boolean()),
  error: z.optional(z.enum(USER_ERROR_CODES)),
});

function toUser(raw: unknown): User {
  const parsed = userRowSchema.safeParse(raw);
  if (!parsed.success) {
    throw new UserError("unavailable");
  }
  const row = parsed.data;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phones: row.phones,
    role: row.role,
    status: row.status,
    depot: row.depots,
  };
}

export class SupabaseUserService implements UserService {
  constructor(
    private readonly client: SupabaseClient,
    // Injected so tests need no network.
    private readonly request: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  async list(): Promise<User[]> {
    const { data, error } = await this.client.from("profiles").select(USER_SELECT).order("full_name");
    if (error) {
      throw new UserError("unavailable");
    }
    return data.map(toUser);
  }

  async get(id: string): Promise<User | null> {
    const { data, error } = await this.client.from("profiles").select(USER_SELECT).eq("id", id).maybeSingle();
    if (error) {
      throw new UserError("unavailable");
    }
    return data === null ? null : toUser(data);
  }

  async create(input: UserSaveInput, password: string): Promise<string> {
    return this.send("POST", USERS_PATH, { ...body(input), password });
  }

  async update(id: string, input: UserSaveInput): Promise<string> {
    return this.send("PATCH", `${USERS_PATH}/${encodeURIComponent(id)}`, body(input));
  }

  async resetPassword(id: string, password: string): Promise<void> {
    await this.send("POST", `${USERS_PATH}/${encodeURIComponent(id)}/reset-password`, { password });
  }

  // Calls an admin endpoint with the signed-in admin's token; returns the answer's id ("" when it has none).
  private async send(method: string, path: string, payload: Record<string, unknown>): Promise<string> {
    const { data } = await this.client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      throw new UserError("unauthenticated");
    }
    let answer: unknown;
    try {
      const response = await this.request(path, {
        method,
        // SECURITY: the server verifies this token with Supabase; the browser's own idea of its role is not used.
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      answer = await response.json();
    } catch {
      throw new UserError("unavailable");
    }
    const parsed = answerSchema.safeParse(answer);
    if (!parsed.success) {
      throw new UserError("unavailable");
    }
    if (parsed.data.error) {
      throw new UserError(parsed.data.error);
    }
    return parsed.data.id ?? "";
  }
}

// The request body the endpoints expect: `status` becomes the `active` switch.
function body(input: UserSaveInput): Record<string, unknown> {
  return {
    fullName: input.fullName,
    email: input.email,
    phones: input.phones,
    role: input.role,
    active: input.status === "active",
    depotId: input.depotId,
  };
}
