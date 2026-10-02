/**
 * The logic behind the admin user endpoints (USR-01 to USR-04, Q-57a, Q-57b, Q-57g).
 *
 * WHY:  Creating a login and setting a password need Supabase's service-role
 *       key, which must never reach the browser (SEC-4). These handlers run only
 *       in Vercel Functions, check who is asking, and then act.
 * HOW:  Every handler does the same first steps: read the Bearer token, ask
 *       Supabase whose login it is, and confirm that person is an active admin,
 *       all before touching anything. Then it checks the input shape and acts
 *       through an `AdminBackend` (Supabase Auth plus the database functions).
 *       The business rules (one email per account, a manager needs a depot, the
 *       last admin stays an admin) live in the database, which checks them again.
 *       Answers are JSON: `{ id }`, `{ ok: true }` or `{ error: "<code>" }`.
 *       Passwords are never logged or sent back.
 * WHEN: Called by the route files under api/admin/users/. Tests give them a fake backend.
 * SECURITY: SEC-1: the caller is verified server-side; nothing the browser says
 *       about its own role is trusted. A failure after a login was created
 *       removes that login again, so no account is left without a profile.
 */
import { z } from "zod/mini";

/** Why a request failed, as far as the app needs to tell the admin. Mirrored in src/services/interfaces/UserService.ts. */
export type UserApiError =
  | "unauthenticated"
  | "not_admin"
  | "invalid"
  | "not_found"
  | "email_taken"
  | "weak_password"
  | "cannot_deactivate_self"
  | "last_admin"
  | "depot_required"
  | "unavailable";

/** HTTP status for each error code. */
const STATUS: Record<UserApiError, number> = {
  unauthenticated: 401,
  not_admin: 403,
  invalid: 400,
  depot_required: 400,
  not_found: 404,
  email_taken: 409,
  cannot_deactivate_self: 409,
  last_admin: 409,
  weak_password: 422,
  unavailable: 500,
};

/** What admin_save_user() needs (supabase/migrations/…_a2c_save_user.sql). */
export interface SaveUserArgs {
  actingAdmin: string;
  target: string;
  fullName: string;
  email: string;
  phones: string[];
  role: "admin" | "distributor" | "depot_manager";
  status: "active" | "inactive";
  depotId: string | null;
  isNew: boolean;
}

/**
 * Everything the handlers need from the outside world.
 * Methods that can fail in an expected way return the error code (or null); only
 * an unexpected failure throws, which the handlers turn into "unavailable".
 */
export interface AdminBackend {
  /** The login id the token belongs to, or null when Supabase does not accept it. */
  getUserId: (token: string) => Promise<string | null>;
  /** True when this id is an active admin profile. */
  isActiveAdmin: (id: string) => Promise<boolean>;
  /** The profile's email, or null when there is no such profile. */
  getProfileEmail: (id: string) => Promise<string | null>;
  /** Creates the login (already confirmed, with the temporary password). */
  createAuthUser: (email: string, password: string) => Promise<{ id: string } | { error: UserApiError }>;
  setAuthEmail: (id: string, email: string) => Promise<UserApiError | null>;
  setAuthPassword: (id: string, password: string) => Promise<UserApiError | null>;
  /** Best effort: removes a login created a moment ago when its profile could not be saved. */
  deleteAuthUser: (id: string) => Promise<void>;
  saveUser: (args: SaveUserArgs) => Promise<UserApiError | null>;
  recordPasswordReset: (actingAdmin: string, target: string) => Promise<UserApiError | null>;
}

// The three roles and two statuses, mirroring the database enums (REQUIREMENTS §4, §8).
const ROLE = z.enum(["admin", "distributor", "depot_manager"]);

// Sizes are bounded so a huge request cannot be used to waste the database's time.
const profileFields = {
  fullName: z.string().check(z.maxLength(200)),
  email: z.string().check(z.maxLength(254)),
  phones: z.array(z.string().check(z.maxLength(30))).check(z.maxLength(10)),
  role: ROLE,
  active: z.boolean(),
  depotId: z.nullable(z.uuid()),
};
// RULE Q-57a: the admin types the first password; it is only ever sent when creating.
// 72: the longest password Supabase accepts.
const password = z.string().check(z.minLength(1), z.maxLength(72));
const createSchema = z.strictObject({ ...profileFields, password });
// RULE Q-57b: passwords are changed only through the reset route, never by an edit.
const editSchema = z.strictObject(profileFields);
const resetSchema = z.strictObject({ password });
const idSchema = z.uuid();
const emailSchema = z.email();

function json(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function fail(error: UserApiError): Response {
  return json({ error }, STATUS[error]);
}

/** The admin's id when the request carries a valid login of an active admin; otherwise the error to send. */
async function requireAdmin(
  request: Request,
  backend: AdminBackend,
): Promise<{ admin: string } | { error: UserApiError }> {
  const match = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "");
  if (!match?.[1]) {
    return { error: "unauthenticated" };
  }
  // SECURITY: the token is checked by Supabase; its claims are never read by hand.
  const id = await backend.getUserId(match[1]);
  if (id === null) {
    return { error: "unauthenticated" };
  }
  // SECURITY: SEC-1 / AUTH-09: only an active admin may go on; the database checks again.
  return (await backend.isActiveAdmin(id)) ? { admin: id } : { error: "not_admin" };
}

// The JSON body, or undefined when it is missing or not JSON.
async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

// Wraps a handler so an unexpected failure (network, Supabase down) becomes "unavailable", never a crash with details.
async function guarded(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch {
    return fail("unavailable");
  }
}

// The profile values, cleaned: trimmed name, trimmed lower-case email. Null when they do not pass.
function cleanProfile(values: z.infer<typeof editSchema>) {
  const fullName = values.fullName.trim();
  const email = values.email.trim().toLowerCase();
  if (fullName === "" || !emailSchema.safeParse(email).success) {
    return null;
  }
  return {
    fullName,
    email,
    phones: values.phones,
    role: values.role,
    status: values.active ? ("active" as const) : ("inactive" as const),
    depotId: values.depotId,
  };
}

/** POST /api/admin/users: creates a login and its profile (USR-01, USR-02, Q-57a). */
export function createUser(request: Request, backend: AdminBackend): Promise<Response> {
  return guarded(async () => {
    const caller = await requireAdmin(request, backend);
    if ("error" in caller) {
      return fail(caller.error);
    }
    const admin = caller.admin;
    const parsed = createSchema.safeParse(await readJson(request));
    const profile = parsed.success ? cleanProfile(parsed.data) : null;
    if (!parsed.success || profile === null) {
      return fail("invalid");
    }

    const created = await backend.createAuthUser(profile.email, parsed.data.password);
    if ("error" in created) {
      return fail(created.error);
    }
    const refused = await backend.saveUser({
      actingAdmin: admin,
      target: created.id,
      ...profile,
      isNew: true,
    });
    if (refused !== null) {
      // The profile was refused: remove the login so the email can be used again.
      await backend.deleteAuthUser(created.id);
      return fail(refused);
    }
    return json({ id: created.id }, 201);
  });
}

/** PATCH /api/admin/users/:id: edits name, email, phones, role, depot and status (USR-01, Q-57g). */
export function updateUser(request: Request, id: string, backend: AdminBackend): Promise<Response> {
  return guarded(async () => {
    const caller = await requireAdmin(request, backend);
    if ("error" in caller) {
      return fail(caller.error);
    }
    const admin = caller.admin;
    const parsed = editSchema.safeParse(await readJson(request));
    const profile = parsed.success ? cleanProfile(parsed.data) : null;
    if (profile === null || !idSchema.safeParse(id).success) {
      return fail("invalid");
    }
    const oldEmail = await backend.getProfileEmail(id);
    if (oldEmail === null) {
      return fail("not_found");
    }

    // The login's email changes first: if Supabase refuses it (already used), nothing else has changed.
    const emailChanged = oldEmail.toLowerCase() !== profile.email;
    if (emailChanged) {
      const refusedEmail = await backend.setAuthEmail(id, profile.email);
      if (refusedEmail !== null) {
        return fail(refusedEmail);
      }
    }
    const refused = await backend.saveUser({ actingAdmin: admin, target: id, ...profile, isNew: false });
    if (refused !== null) {
      if (emailChanged) {
        // Keep the login and the profile in step: put the old email back (best effort).
        await backend.setAuthEmail(id, oldEmail);
      }
      return fail(refused);
    }
    return json({ id }, 200);
  });
}

/** POST /api/admin/users/:id/reset-password: sets a new temporary password (USR-04, Q-57b). */
export function resetPassword(request: Request, id: string, backend: AdminBackend): Promise<Response> {
  return guarded(async () => {
    const caller = await requireAdmin(request, backend);
    if ("error" in caller) {
      return fail(caller.error);
    }
    const admin = caller.admin;
    const parsed = resetSchema.safeParse(await readJson(request));
    if (!parsed.success || !idSchema.safeParse(id).success) {
      return fail("invalid");
    }
    const refused = await backend.setAuthPassword(id, parsed.data.password);
    if (refused !== null) {
      return fail(refused);
    }
    // RULE AUD-03: the reset is logged. If that fails the admin is told, so they can try again.
    const logRefused = await backend.recordPasswordReset(admin, id);
    return logRefused === null ? json({ ok: true }, 200) : fail(logRefused);
  });
}
