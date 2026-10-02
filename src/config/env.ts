/**
 * Typed, validated runtime configuration (ARCHITECTURE §3.2 `config/env.ts`).
 *
 * WHY:  The app must know which backend to talk to. A deployed build must
 *       always use Supabase so every tester shares one database (NFR-03, Q-37);
 *       the in-browser mock exists only for tests and offline local work.
 * HOW:  `readAppConfig` validates the raw values with Zod and returns either a
 *       usable config or `{ ok: false }`, which App.tsx turns into a plain
 *       "not connected" screen. `appConfig` is the result for this build.
 * WHEN: Read once when the app starts (App.tsx).
 * SECURITY: Only the project URL and the *public* key are read here; the build
 *       refuses to embed a secret key (tooling/supabase-public-env.ts). The URL
 *       must be https so the key and passwords never travel unencrypted. The
 *       mock can only be chosen in a development build (`dev`), so a stray
 *       VITE_DATA_SOURCE=mock on Vercel cannot switch real users to fake logins.
 */
import { z } from "zod/mini";

export type AppConfig =
  | { ok: true; dataSource: "supabase"; supabase: { url: string; publicKey: string } }
  | { ok: true; dataSource: "mock"; mockPassword: string }
  | { ok: false };

const supabaseSchema = z.object({
  VITE_SUPABASE_URL: z.url({ protocol: /^https$/ }),
  VITE_SUPABASE_ANON_KEY: z.string().check(z.minLength(1)),
});

/** Validates raw environment values. `dev` is true only for `npm run dev` and tests. */
export function readAppConfig(
  raw: Readonly<Record<string, unknown>>,
  { dev }: Readonly<{ dev: boolean }>,
): AppConfig {
  // RULE NFR-03: the mock is a development tool, never deployed. Its users'
  // password is chosen by the developer in .env.local, so none is written in code.
  if (dev && raw.VITE_DATA_SOURCE === "mock") {
    const mockPassword = raw.VITE_MOCK_PASSWORD;
    return typeof mockPassword === "string" && mockPassword !== ""
      ? { ok: true, dataSource: "mock", mockPassword }
      : { ok: false };
  }
  const parsed = supabaseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false };
  }
  return {
    ok: true,
    dataSource: "supabase",
    supabase: { url: parsed.data.VITE_SUPABASE_URL, publicKey: parsed.data.VITE_SUPABASE_ANON_KEY },
  };
}

/** This build's configuration. */
export const appConfig: AppConfig = readAppConfig(import.meta.env, { dev: import.meta.env.DEV });
