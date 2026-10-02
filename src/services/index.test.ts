/**
 * Tests for choosing the backend (NFR-03: mock only in development builds).
 */
import { MOCK_PASSWORD } from "../../tests/helpers/mockPassword";
import { describe, expect, it, vi } from "vitest";

import { createServices } from "./index";
import { MockAuthService } from "./mock/MockAuthService";
import { MockDepotService } from "./mock/MockDepotService";
import { MockProductService } from "./mock/MockProductService";
import { SupabaseAuthService } from "./supabase/SupabaseAuthService";
import { SupabaseDepotService } from "./supabase/SupabaseDepotService";
import { SupabaseProductService } from "./supabase/SupabaseProductService";

describe("createServices", () => {
  it("uses Supabase for a Supabase configuration", () => {
    const services = createServices({
      ok: true,
      dataSource: "supabase",
      supabase: { url: "https://abc.supabase.co", publicKey: "sb_publishable_x" },
    });
    expect(services.auth).toBeInstanceOf(SupabaseAuthService);
    expect(services.products).toBeInstanceOf(SupabaseProductService);
    expect(services.depots).toBeInstanceOf(SupabaseDepotService);
  });

  it("uses the mock in development builds when asked", () => {
    const services = createServices({ ok: true, dataSource: "mock", mockPassword: MOCK_PASSWORD });
    expect(services.auth).toBeInstanceOf(MockAuthService);
    expect(services.products).toBeInstanceOf(MockProductService);
    expect(services.depots).toBeInstanceOf(MockDepotService);
  });

  it("SECURITY: refuses the mock in a production build", () => {
    vi.stubEnv("DEV", false);
    try {
      expect(() => createServices({ ok: true, dataSource: "mock", mockPassword: MOCK_PASSWORD })).toThrow(
        /not available/,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
