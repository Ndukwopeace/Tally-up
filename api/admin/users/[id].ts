/**
 * PATCH /api/admin/users/:id: edits an account, including deactivating it (USR-01, Q-57g).
 *
 * WHY:  A new email must also change the login in Supabase Auth, which needs the
 *       service-role key (SEC-4).
 * HOW:  Hands the request to updateUser() with the real backend and the id from the address.
 * WHEN: The Users form calls it with the admin's login token in the Authorization header.
 * SECURITY: updateUser() verifies the caller is an active admin before doing anything.
 */
import { updateUser } from "../../_lib/adminUsers.js";
import { accountIdFromPath, withBackend } from "../../_lib/route.js";

export function PATCH(request: Request): Promise<Response> {
  return withBackend((backend) => updateUser(request, accountIdFromPath(request), backend));
}
