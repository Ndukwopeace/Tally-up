/**
 * DepotService backed by Supabase (ARCHITECTURE §6).
 *
 * WHY:  The deployed app stores depots in Postgres, shared by every phone.
 * HOW:  Reads `depots` with the manager accounts linked to them
 *       (profiles.depot_id) in one request; only the active manager is shown
 *       (DEP-03). Rows are Zod-checked (SEC-5). Saves through the database
 *       function `admin_save_depot`, the only write path.
 * WHEN: Created by services/index.ts in Supabase mode.
 * SECURITY: RLS decides which rows come back; the save function refuses
 *       anyone but an active admin. Raw database messages never reach the screen.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/mini";

import type { DepotSaveInput } from "@/domain/depots";
import { DepotError, type DepotService } from "@/services/interfaces/DepotService";
import type { Depot, ManagerOption } from "@/types/entities";
import { RECORD_STATUSES, ROLES } from "@/types/enums";

// `profiles` here are the accounts whose depot_id points at the depot.
const DEPOT_SELECT = "id, name, location, address, phones, status, profiles (id, full_name, role, status)";

const depotRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  address: z.string(),
  phones: z.array(z.string()),
  status: z.enum(RECORD_STATUSES),
  profiles: z.array(
    z.object({ id: z.string(), full_name: z.string(), role: z.enum(ROLES), status: z.enum(RECORD_STATUSES) }),
  ),
});

const managerRowSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  email: z.string(),
  status: z.enum(RECORD_STATUSES),
  depot_id: z.nullable(z.string()),
});

// One row → Depot. The active depot manager linked to it is "the" manager (DEP-03).
function toDepot(raw: unknown): Depot {
  const parsed = depotRowSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DepotError("unavailable");
  }
  const row = parsed.data;
  const manager = row.profiles.find(
    (profile) => profile.role === "depot_manager" && profile.status === "active",
  );
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    address: row.address,
    phones: row.phones,
    status: row.status,
    manager: manager ? { id: manager.id, fullName: manager.full_name } : null,
  };
}

function toManager(raw: unknown): ManagerOption {
  const parsed = managerRowSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DepotError("unavailable");
  }
  const row = parsed.data;
  return { id: row.id, fullName: row.full_name, email: row.email, status: row.status, depotId: row.depot_id };
}

// Error messages raised by admin_save_depot → codes.
const SAVE_ERRORS: Record<string, DepotError["code"]> = {
  INVALID_DEPOT: "invalid",
  NOT_FOUND: "not_found",
  NOT_A_MANAGER: "not_a_manager",
  NOT_ADMIN: "not_admin",
};

export class SupabaseDepotService implements DepotService {
  constructor(private readonly client: SupabaseClient) {}

  async list(): Promise<Depot[]> {
    const { data, error } = await this.client.from("depots").select(DEPOT_SELECT).order("name");
    if (error) {
      throw new DepotError("unavailable");
    }
    return data.map(toDepot);
  }

  async get(id: string): Promise<Depot | null> {
    const { data, error } = await this.client.from("depots").select(DEPOT_SELECT).eq("id", id).maybeSingle();
    if (error) {
      throw new DepotError("unavailable");
    }
    return data === null ? null : toDepot(data);
  }

  async listManagers(): Promise<ManagerOption[]> {
    const { data, error } = await this.client
      .from("profiles")
      .select("id, full_name, email, status, depot_id")
      .eq("role", "depot_manager")
      .order("full_name");
    if (error) {
      throw new DepotError("unavailable");
    }
    return data.map(toManager);
  }

  async save(input: DepotSaveInput, id?: string): Promise<string> {
    const result = await this.client.rpc("admin_save_depot", {
      target_depot_id: id ?? null,
      depot_name: input.name,
      depot_location: input.location,
      depot_address: input.address,
      depot_phones: input.phones,
      depot_status: input.status,
      manager_id: input.managerId,
    });
    // The client is untyped (no generated database types), so the answer is checked here.
    const data: unknown = result.data;
    if (result.error) {
      throw new DepotError(SAVE_ERRORS[result.error.message] ?? "unavailable");
    }
    if (typeof data !== "string") {
      throw new DepotError("unavailable");
    }
    return data;
  }
}
