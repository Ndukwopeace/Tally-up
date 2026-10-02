/**
 * POST /api/admin/users/:id/reset-password: sets a new temporary password (USR-04, Q-57b).
 *
 * WHY:  Setting another person's password needs the service-role key (SEC-4).
 * HOW:  Hands the request to resetPassword() with the real backend and the id from the address.
 * WHEN: The user's edit page calls it with the admin's login token in the Authorization header.
 * SECURITY: resetPassword() verifies the caller is an active admin before doing anything.
 */
import { resetPassword } from "../../../_lib/adminUsers.js";
import { accountIdFromPath, withBackend } from "../../../_lib/route.js";

export function POST(request: Request): Promise<Response> {
  return withBackend((backend) => resetPassword(request, accountIdFromPath(request), backend));
}
