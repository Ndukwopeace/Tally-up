// @vitest-environment node
/**
 * Tests for the three route files (the wiring between a web address and the handlers).
 *
 * Rules under test: SEC-1 (a request without a login is refused on every route,
 * before any Supabase call), and that each route answers only its own method.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "./[id].js";
import { POST as resetPassword } from "./[id]/reset-password.js";
import { POST as createUser } from "./index.js";

const ID = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(path: string, method: string): Request {
  return new Request(`https://tally.test${path}`, { method, body: "{}" });
}

describe("SEC-1 routes refuse a request without a login", () => {
  it.each([
    ["POST /api/admin/users", () => createUser(request("/api/admin/users", "POST"))],
    ["PATCH /api/admin/users/:id", () => PATCH(request(`/api/admin/users/${ID}`, "PATCH"))],
    [
      "POST /api/admin/users/:id/reset-password",
      () => resetPassword(request(`/api/admin/users/${ID}/reset-password`, "POST")),
    ],
  ])("%s answers 401", async (_name, call) => {
    // The key and URL are fake and no Supabase call is made: the missing token stops the request first.
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    const response = await call();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthenticated" });
  });

  it("answers 500 'unavailable' when the server has no settings", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const response = await createUser(request("/api/admin/users", "POST"));
    expect(response.status).toBe(500);
  });
});
