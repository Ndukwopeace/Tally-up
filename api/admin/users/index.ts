/**
 * POST /api/admin/users: creates an account (AUTH-02, USR-01, USR-02, Q-57a).
 *
 * WHY:  Only an admin creates accounts, and that needs the service-role key,
 *       which exists only here on the server (SEC-4).
 * HOW:  Hands the request to createUser() with the real backend.
 * WHEN: The Users form calls it with the admin's login token in the Authorization header.
 * SECURITY: createUser() verifies the caller is an active admin before doing anything.
 */
import { createUser } from "../../_lib/adminUsers.js";
import { withBackend } from "../../_lib/route.js";

export function POST(request: Request): Promise<Response> {
  return withBackend((backend) => createUser(request, backend));
}
