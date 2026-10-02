/**
 * Tests for picking the Supabase URL and public key at build time.
 *
 * Rules under test:
 *  - NFR-13 / ARCHITECTURE §15: the browser gets the project URL and the public
 *    (anon / publishable) key, whatever names the Vercel integration gave them.
 *  - SEC-4: a secret key can never be chosen; the build stops instead.
 */
import { describe, expect, it } from "vitest";

import { resolvePublicSupabaseEnv } from "./supabase-public-env";

// Builds a fake, unsigned JWT with the given payload. Signature is irrelevant here.
function fakeJwt(payload: Record<string, unknown>): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part(payload)}.signature`;
}

const URL_VALUE = "https://abcdefgh.supabase.co";

describe("resolvePublicSupabaseEnv", () => {
  it("returns empty values when nothing is set (local development with the mock)", () => {
    expect(resolvePublicSupabaseEnv({})).toEqual({ url: "", publicKey: "" });
  });

  it("prefers VITE_ names when present", () => {
    const env = {
      VITE_SUPABASE_URL: URL_VALUE,
      VITE_SUPABASE_ANON_KEY: "sb_publishable_vite",
      SUPABASE_URL: "https://other.supabase.co",
      SUPABASE_ANON_KEY: "sb_publishable_other",
    };
    expect(resolvePublicSupabaseEnv(env)).toEqual({ url: URL_VALUE, publicKey: "sb_publishable_vite" });
  });

  it.each([
    ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
    ["SUPABASE_URL", "SUPABASE_ANON_KEY"],
    ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"],
    ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"],
  ])("accepts the names the Vercel integration may create: %s + %s", (urlName, keyName) => {
    const env = { [urlName]: URL_VALUE, [keyName]: "sb_publishable_abc" };
    expect(resolvePublicSupabaseEnv(env)).toEqual({ url: URL_VALUE, publicKey: "sb_publishable_abc" });
  });

  it("accepts a legacy anon JWT key", () => {
    const anon = fakeJwt({ role: "anon", iss: "supabase" });
    expect(resolvePublicSupabaseEnv({ SUPABASE_URL: URL_VALUE, SUPABASE_ANON_KEY: anon }).publicKey).toBe(
      anon,
    );
  });

  it("trims stray spaces and line breaks pasted into the dashboard", () => {
    expect(resolvePublicSupabaseEnv({ SUPABASE_URL: ` ${URL_VALUE}\n`, SUPABASE_ANON_KEY: " k " })).toEqual({
      url: URL_VALUE,
      publicKey: "k",
    });
  });

  it("SECURITY: stops the build if the chosen key is a new-style secret key", () => {
    expect(() =>
      resolvePublicSupabaseEnv({ SUPABASE_URL: URL_VALUE, SUPABASE_ANON_KEY: "sb_secret_x" }),
    ).toThrow(/secret key/);
  });

  it("SECURITY: stops the build if the chosen key is a JWT for any role other than anon", () => {
    const privileged = fakeJwt({ role: "service" + "_role" });
    expect(() =>
      resolvePublicSupabaseEnv({ SUPABASE_URL: URL_VALUE, SUPABASE_ANON_KEY: privileged }),
    ).toThrow(/secret key/);
  });

  it("does not choke on a key that only looks like a JWT", () => {
    expect(
      resolvePublicSupabaseEnv({ SUPABASE_URL: URL_VALUE, SUPABASE_ANON_KEY: "a.%%%.c" }).publicKey,
    ).toBe("a.%%%.c");
  });
});
