/**
 * In-memory DepotService for tests and offline local development (ARCHITECTURE §7).
 *
 * WHY:  Tests need depots without a database; the mock follows the same rules
 *       as admin_save_depot (DEP-03, Q-57c) so tests written against it hold
 *       for Supabase.
 * HOW:  Arrays of depots and manager accounts. Assigning a manager makes them
 *       active at that depot; a different manager who ran the depot is
 *       deactivated and loses it. Helpers let tests fail or hold the next call.
 * WHEN: Tests, and `npm run dev` with VITE_DATA_SOURCE=mock.
 * SECURITY: Never deployed (services/index.ts selects it in development builds only).
 */
import type { DepotSaveInput } from "@/domain/depots";
import { DepotError, type DepotErrorCode, type DepotService } from "@/services/interfaces/DepotService";
import type { Depot, ManagerOption } from "@/types/entities";

/** A depot as stored by the mock: the manager is derived from `managers`. */
type StoredDepot = Omit<Depot, "manager">;

export class MockDepotService implements DepotService {
  private readonly depots: StoredDepot[];
  private readonly managers: ManagerOption[];
  private nextFailure: DepotErrorCode | null = null;
  private nextHold: Promise<void> | null = null;
  private counter = 0;

  constructor(depots: StoredDepot[] = [], managers: ManagerOption[] = []) {
    this.depots = depots.map((depot) => ({ ...depot, phones: [...depot.phones] }));
    this.managers = managers.map((manager) => ({ ...manager }));
  }

  /** Makes the next call fail with `code`. */
  failNextCallWith(code: DepotErrorCode): void {
    this.nextFailure = code;
  }

  /** Makes the next call wait until the returned function is called. */
  holdNextCall(): () => void {
    let release: (() => void) | undefined;
    this.nextHold = new Promise<void>((resolve) => {
      release = resolve;
    });
    return () => {
      release?.();
    };
  }

  async list(): Promise<Depot[]> {
    await this.beforeCall();
    return [...this.depots]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((depot) => this.withManager(depot));
  }

  async get(id: string): Promise<Depot | null> {
    await this.beforeCall();
    const found = this.depots.find((depot) => depot.id === id);
    return found ? this.withManager(found) : null;
  }

  async listManagers(): Promise<ManagerOption[]> {
    await this.beforeCall();
    return [...this.managers]
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((manager) => ({ ...manager }));
  }

  async save(input: DepotSaveInput, id?: string): Promise<string> {
    await this.beforeCall();
    const { managerId, ...fields } = input;
    // RULE Q-58c: an inactive depot has no manager, so none can be chosen for it.
    if (fields.status === "inactive" && managerId !== null) {
      throw new DepotError("invalid");
    }
    let savedId: string;
    if (id === undefined) {
      this.counter += 1;
      savedId = `mock-depot-${String(this.counter)}`;
      this.depots.push({ id: savedId, ...fields, phones: [...fields.phones] });
    } else {
      const index = this.depots.findIndex((depot) => depot.id === id);
      if (index === -1) {
        throw new DepotError("not_found");
      }
      this.depots[index] = { id, ...fields, phones: [...fields.phones] };
      savedId = id;
    }
    // RULE Q-58c: switching a depot to inactive deactivates its manager and takes them off it.
    if (fields.status === "inactive") {
      this.release(savedId);
    }
    if (managerId !== null) {
      this.assign(savedId, managerId);
    }
    return savedId;
  }

  // RULE Q-58c: the active manager of this depot is deactivated and has no depot.
  private release(depotId: string): void {
    for (const manager of this.managers) {
      if (manager.depotId === depotId && manager.status === "active") {
        manager.status = "inactive";
        manager.depotId = null;
      }
    }
  }

  // RULE DEP-03 / Q-57c: the chosen manager runs the depot; the one replaced is deactivated.
  private assign(depotId: string, managerId: string): void {
    const chosen = this.managers.find((manager) => manager.id === managerId);
    if (!chosen) {
      throw new DepotError("not_a_manager");
    }
    for (const manager of this.managers) {
      if (manager.depotId === depotId && manager.status === "active" && manager.id !== managerId) {
        manager.status = "inactive";
        manager.depotId = null;
      }
    }
    chosen.depotId = depotId;
    chosen.status = "active";
  }

  // The depot with its active manager, as the Supabase service returns it.
  private withManager(depot: StoredDepot): Depot {
    const manager = this.managers.find(
      (candidate) => candidate.depotId === depot.id && candidate.status === "active",
    );
    return {
      ...depot,
      phones: [...depot.phones],
      manager: manager ? { id: manager.id, fullName: manager.fullName } : null,
    };
  }

  // Applies a pending hold or failure set by a test, once.
  private async beforeCall(): Promise<void> {
    if (this.nextHold) {
      const hold = this.nextHold;
      this.nextHold = null;
      await hold;
    }
    if (this.nextFailure) {
      const code = this.nextFailure;
      this.nextFailure = null;
      throw new DepotError(code);
    }
  }
}
