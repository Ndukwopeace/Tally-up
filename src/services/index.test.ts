/**
 * Tests for choosing the backend (NFR-03: mock only in development builds).
 */
import { MOCK_PASSWORD } from "../../tests/helpers/mockPassword";
import { describe, expect, it, vi } from "vitest";

import { createAuthService } from "./index";
import { MockAuthService } from "./mock/MockAuthService";
import { SupabaseAuthService } from "./supabase/SupabaseAuthService";

describe("createAuthService", () => {
  it("uses Supabase for a Supabase configuration", () => {
    const service = createAuthService({
      ok: true,
      dataSource: "supabase",
      supabase: { url: "https://abc.supabase.co", publicKey: "sb_publishable_x" },
    });
    expect(service).toBeInstanceOf(SupabaseAuthService);
  });

  it("uses the mock in development builds when asked", () => {
    expect(createAuthService({ ok: true, dataSource: "mock", mockPassword: MOCK_PASSWORD })).toBeInstanceOf(
      MockAuthService,
    );
  });

  it("SECURITY: refuses the mock in a production build", () => {
    vi.stubEnv("DEV", false);
    try {
      expect(() => createAuthService({ ok: true, dataSource: "mock", mockPassword: MOCK_PASSWORD })).toThrow(
        /not available/,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
