/**
 * In-memory UserService for tests and offline local development (ARCHITECTURE §7).
 *
 * WHY:  Tests need accounts without a database or a server; the mock follows the
 *       same rules as admin_save_user (USR-02, USR-03, USR-06, Q-57c, Q-57g) so
 *       tests written against it hold for Supabase.
 * HOW:  An array of accounts and the depot names. Saving checks the rules in the
 *       same order as the database, applies the change and, for a manager put in
 *       charge of a depot, deactivates the manager who ran it before. The acting
 *       admin is `actingAdmin`. Helpers let tests fail or hold the next call, and
 *       `passwords` records the last password set, for assertions only.
 * WHEN: Tests, and `npm run dev` with VITE_DATA_SOURCE=mock.
 * SECURITY: Never deployed (services/index.ts selects it in development builds only).
 *       The mock's depot and account lists are separate from MockDepotService's.
 */
import type { UserSaveInput } from "@/domain/users";
import { UserError, type UserErrorCode, type UserService } from "@/services/interfaces/UserService";
import type { User, UserDepotRef } from "@/types/entities";

export class MockUserService implements UserService {
  private readonly users: User[];
  private readonly depots: UserDepotRef[];
  private readonly actingAdmin: string;
  /** The last password set for each account id: for tests only. */
  readonly passwords = new Map<string, string>();
  private nextFailure: UserErrorCode | null = null;
  private nextHold: Promise<void> | null = null;
  private counter = 0;

  constructor(users: User[] = [], depots: UserDepotRef[] = [], actingAdmin = "") {
    this.users = users.map((user) => ({ ...user, phones: [...user.phones] }));
    this.depots = depots.map((depot) => ({ ...depot }));
    this.actingAdmin = actingAdmin;
  }

  /** Makes the next call fail with `code`. */
  failNextCallWith(code: UserErrorCode): void {
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

  async list(): Promise<User[]> {
    await this.beforeCall();
    return [...this.users].sort((a, b) => a.fullName.localeCompare(b.fullName)).map(copy);
  }

  async get(id: string): Promise<User | null> {
    await this.beforeCall();
    const found = this.users.find((user) => user.id === id);
    return found ? copy(found) : null;
  }

  async create(input: UserSaveInput, password: string): Promise<string> {
    await this.beforeCall();
    // RULE USR-02: one account per email, whatever the letter case.
    this.checkRules(undefined, input);
    this.counter += 1;
    const id = `mock-user-${String(this.counter)}`;
    this.users.push({
      id,
      fullName: input.fullName,
      email: input.email,
      phones: [],
      role: input.role,
      status: input.status,
      depot: null,
    });
    this.apply(id, input);
    this.passwords.set(id, password);
    return id;
  }

  async update(id: string, input: UserSaveInput): Promise<string> {
    await this.beforeCall();
    const current = this.users.find((user) => user.id === id);
    if (!current) {
      throw new UserError("not_found");
    }
    this.checkRules(current, input);
    this.apply(id, input);
    return id;
  }

  async resetPassword(id: string, password: string): Promise<void> {
    await this.beforeCall();
    if (!this.users.some((user) => user.id === id)) {
      throw new UserError("not_found");
    }
    this.passwords.set(id, password);
  }

  // The rules admin_save_user() checks before it changes anything.
  private checkRules(current: User | undefined, input: UserSaveInput): void {
    if (this.users.some((user) => user.id !== current?.id && user.email.toLowerCase() === input.email)) {
      throw new UserError("email_taken");
    }
    // RULE USR-06 / Q-57f: no self-deactivation; the last active admin keeps the role.
    if (current && input.status === "inactive" && current.id === this.actingAdmin) {
      throw new UserError("cannot_deactivate_self");
    }
    const leavesAdmin =
      current?.role === "admin" &&
      current.status === "active" &&
      (input.role !== "admin" || input.status !== "active");
    if (
      leavesAdmin &&
      !this.users.some((user) => user.id !== current.id && user.role === "admin" && user.status === "active")
    ) {
      throw new UserError("last_admin");
    }
    // RULE USR-03: an active depot manager needs a depot that exists.
    if (input.role === "depot_manager" && input.status === "active" && input.depotId === null) {
      throw new UserError("depot_required");
    }
    if (input.depotId !== null && !this.depots.some((depot) => depot.id === input.depotId)) {
      throw new UserError("invalid");
    }
  }

  // Writes the values; a manager put in charge of a depot replaces the one who ran it (DEP-03, Q-57c).
  private apply(id: string, input: UserSaveInput): void {
    const user = this.users.find((candidate) => candidate.id === id);
    if (!user) {
      return;
    }
    user.fullName = input.fullName;
    user.email = input.email;
    user.phones = [...input.phones];
    user.role = input.role;
    user.status = input.status;
    const depot = this.depots.find((candidate) => candidate.id === input.depotId);
    if (depot && input.status === "active") {
      for (const other of this.users) {
        if (other.id !== id && other.depot?.id === depot.id) {
          other.status = "inactive";
          other.depot = null;
        }
      }
    }
    user.depot = depot && input.status === "active" ? { ...depot } : null;
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
      throw new UserError(code);
    }
  }
}

function copy(user: User): User {
  return { ...user, phones: [...user.phones], depot: user.depot && { ...user.depot } };
}
