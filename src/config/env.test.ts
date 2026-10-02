/**
 * Tests for reading the app's runtime configuration.
 *
 * Rules under test:
 *  - NFR-03: deployed builds use Supabase; the mock is for tests and offline
 *    local development only (ARCHITECTURE §7, amendment A-2).
 *  - NFR-13: Supabase settings come from environment variables.
 */
import { describe, expect, it } from "vitest";

import { readAppConfig } from "./env";

const GOOD = { VITE_SUPABASE_URL: "https://abc.supabase.co", VITE_SUPABASE_ANON_KEY: "sb_publishable_x" };

describe("readAppConfig", () => {
  it("uses Supabase by default when the URL and key are set", () => {
    expect(readAppConfig(GOOD, { dev: false })).toEqual({
      ok: true,
      dataSource: "supabase",
      supabase: { url: "https://abc.supabase.co", publicKey: "sb_publishable_x" },
    });
  });

  it("reports missing settings instead of starting without a database", () => {
    expect(readAppConfig({}, { dev: false })).toEqual({ ok: false });
    expect(readAppConfig({ VITE_SUPABASE_URL: "https://abc.supabase.co" }, { dev: false })).toEqual({
      ok: false,
    });
  });

  it("SECURITY: refuses a URL that is not https, so keys never travel unencrypted", () => {
    expect(readAppConfig({ ...GOOD, VITE_SUPABASE_URL: "http://abc.supabase.co" }, { dev: false })).toEqual({
      ok: false,
    });
    expect(readAppConfig({ ...GOOD, VITE_SUPABASE_URL: "not a url" }, { dev: false })).toEqual({ ok: false });
  });

  it("uses the mock only in local development when asked, with the developer's chosen password", () => {
    expect(readAppConfig({ VITE_DATA_SOURCE: "mock", VITE_MOCK_PASSWORD: "chosen" }, { dev: true })).toEqual({
      ok: true,
      dataSource: "mock",
      mockPassword: "chosen",
    });
  });

  it("reports missing settings when the mock has no password set", () => {
    expect(readAppConfig({ VITE_DATA_SOURCE: "mock" }, { dev: true })).toEqual({ ok: false });
    expect(readAppConfig({ VITE_DATA_SOURCE: "mock", VITE_MOCK_PASSWORD: "" }, { dev: true })).toEqual({
      ok: false,
    });
  });

  it("SECURITY: never uses the mock in a deployed build, even when asked", () => {
    expect(readAppConfig({ ...GOOD, VITE_DATA_SOURCE: "mock" }, { dev: false })).toMatchObject({
      ok: true,
      dataSource: "supabase",
    });
    expect(readAppConfig({ VITE_DATA_SOURCE: "mock", VITE_MOCK_PASSWORD: "chosen" }, { dev: false })).toEqual(
      {
        ok: false,
      },
    );
  });
});
