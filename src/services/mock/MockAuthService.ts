/**
 * In-browser stand-in for Supabase Auth (ARCHITECTURE §5.3, §7).
 *
 * WHY:  Automated tests must run without a network or a real database, and a
 *       developer may work offline. The mock implements the same AuthService
 *       interface so code written against it works unchanged with Supabase.
 * HOW:  A fixed list of fictional users (one per role, plus an inactive admin
 *       and a login with no profile) and one shared demo password. The session
 *       is the signed-in user id, kept in memory or in the given storage
 *       (localStorage in local development). Helpers let tests fail or hold
 *       the next call, so error and loading states can be exercised.
 * WHEN: Tests, and `npm run dev` with VITE_DATA_SOURCE=mock.
 * SECURITY: Never deployed: config/env.ts only selects it in development
 *       builds, and services/index.ts imports it only behind that check, so it
 *       is left out of production bundles. The demo password is public on
 *       purpose and protects nothing real.
 */
import type { Account } from "@/types/entities";
import {
  AuthError,
  type AuthErrorCode,
  type AuthService,
  type LoginMethod,
} from "@/services/interfaces/AuthService";

/** The one password every mock user has (listed in README for local development). */
export const MOCK_PASSWORD = "tally-demo-1";

/** Fictional accounts, one per case the app must handle. */
export const MOCK_USERS = {
  admin: {
    id: "mock-admin",
    fullName: "Ama Admin",
    email: "admin@tallyup.test",
    role: "admin",
    status: "active",
  },
  inactiveAdmin: {
    id: "mock-old-admin",
    fullName: "Old Admin",
    email: "old.admin@tallyup.test",
    role: "admin",
    status: "inactive",
  },
  distributor: {
    id: "mock-distributor",
    fullName: "Dan Distributor",
    email: "distributor@tallyup.test",
    role: "distributor",
    status: "active",
  },
  manager: {
    id: "mock-manager",
    fullName: "Mia Manager",
    email: "manager@tallyup.test",
    role: "depot_manager",
    status: "active",
  },
} as const satisfies Record<string, Account>;

// A login that exists in "auth" but has no Tally-Up profile (AUTH-04 case).
const ORPHAN_LOGIN = { id: "mock-orphan", email: "orphan@tallyup.test" };

// Key under which the session lives in storage.
const SESSION_KEY = "tally-up.mock-session";

/** The part of the Web Storage API the mock needs (localStorage fits). */
export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface MockAuthOptions {
  /** Start signed in as this user id. */
  signedInAs?: string;
  /** Keep the session here so it survives a page refresh. */
  storage?: SessionStorageLike;
}

export class MockAuthService implements AuthService {
  /** AUD-03 entries written, for tests to inspect. */
  readonly logins: { accountId: string; method: LoginMethod }[] = [];
  /** Reset emails "sent", for tests to inspect. */
  readonly resetRequests: { email: string; redirectTo: string }[] = [];

  private readonly accounts: Account[] = Object.values(MOCK_USERS).map((user) => ({ ...user }));
  private readonly passwords = new Map<string, string>(
    [...Object.values(MOCK_USERS), ORPHAN_LOGIN].map((user) => [user.id, MOCK_PASSWORD]),
  );
  private readonly listeners = new Set<() => void>();
  private memorySession: string | null;
  private nextFailure: AuthErrorCode | null = null;
  private nextHold: Promise<void> | null = null;

  constructor(private readonly options: MockAuthOptions = {}) {
    this.memorySession = options.signedInAs ?? null;
    if (options.signedInAs) {
      options.storage?.setItem(SESSION_KEY, options.signedInAs);
    }
  }

  /** Makes the next call fail with `code` (ARCHITECTURE §7: test error states). */
  failNextCallWith(code: AuthErrorCode): void {
    this.nextFailure = code;
  }

  /** Makes the next call wait until the returned function is called (test loading states). */
  holdNextCall(): () => void {
    let release: (() => void) | undefined;
    this.nextHold = new Promise<void>((resolve) => {
      release = resolve;
    });
    return () => {
      release?.();
    };
  }

  /** Simulates the session ending outside the app (token expired, other tab). */
  endSessionElsewhere(): void {
    this.setSession(null);
    for (const listener of this.listeners) {
      listener();
    }
  }

  async getAccount(): Promise<Account | null> {
    await this.beforeCall();
    const id = this.session();
    return id === null ? null : this.profileOf(id);
  }

  async signInWithPassword(email: string, password: string): Promise<Account> {
    await this.beforeCall();
    const login = [...this.accounts, ORPHAN_LOGIN].find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
    // SECURITY: same error for unknown email and wrong password, like Supabase (no account probing).
    if (!login || this.passwords.get(login.id) !== password) {
      throw new AuthError("invalid_credentials");
    }
    this.setSession(login.id);
    return this.profileOf(login.id);
  }

  async signOut(): Promise<void> {
    await this.beforeCall();
    this.setSession(null);
  }

  async recordLogin(method: LoginMethod): Promise<void> {
    await this.beforeCall();
    const account = this.signedInAccount();
    // Mirrors record_login() in the database: inactive accounts cannot log in (AUTH-09).
    if (account.status !== "active") {
      throw new AuthError("inactive");
    }
    this.logins.push({ accountId: account.id, method });
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    await this.beforeCall();
    this.resetRequests.push({ email, redirectTo });
  }

  async updatePassword(newPassword: string): Promise<void> {
    await this.beforeCall();
    const account = this.signedInAccount();
    if (this.passwords.get(account.id) === newPassword) {
      throw new AuthError("same_password");
    }
    this.passwords.set(account.id, newPassword);
  }

  onSessionEnded(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
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
      throw new AuthError(code);
    }
  }

  private session(): string | null {
    return this.options.storage ? this.options.storage.getItem(SESSION_KEY) : this.memorySession;
  }

  private setSession(id: string | null): void {
    this.memorySession = id;
    if (id === null) {
      this.options.storage?.removeItem(SESSION_KEY);
    } else {
      this.options.storage?.setItem(SESSION_KEY, id);
    }
  }

  // The profile of a signed-in login; a login without one is AUTH-04's "no account".
  private profileOf(id: string): Account {
    const account = this.accounts.find((candidate) => candidate.id === id);
    if (!account) {
      throw new AuthError("no_account");
    }
    return { ...account };
  }

  private signedInAccount(): Account {
    const id = this.session();
    if (id === null) {
      throw new AuthError("session_missing");
    }
    return this.profileOf(id);
  }
}
