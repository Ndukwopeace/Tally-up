/**
 * Shared steps of the three admin user routes.
 *
 * WHY:  Each route file stays a few lines, and the parts that are the same
 *       (pick the backend, read the account id from the address) live once.
 * HOW:  `withBackend` builds the backend from the server's environment and
 *       answers 500 "unavailable" when the settings are missing.
 *       `accountIdFromPath` takes the account id out of /api/admin/users/<id>[/…].
 * WHEN: Called by api/admin/users/index.ts, [id].ts and [id]/reset-password.ts.
 * SECURITY: A missing key is reported as a plain "unavailable", never with details.
 */
import type { AdminBackend } from "./adminUsers.js";
import { backendFromEnv } from "./supabaseBackend.js";

/** Runs `handler` with the real backend, or answers "unavailable" when the server is not set up. */
export function withBackend(handler: (backend: AdminBackend) => Promise<Response>): Promise<Response> {
  const backend = backendFromEnv(process.env);
  if (backend === null) {
    return Promise.resolve(Response.json({ error: "unavailable" }, { status: 500 }));
  }
  return handler(backend);
}

/** The account id in /api/admin/users/<id> or /api/admin/users/<id>/reset-password ("" when absent). */
export function accountIdFromPath(request: Request): string {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  // ["api", "admin", "users", "<id>", …]
  return segments[3] ?? "";
}
