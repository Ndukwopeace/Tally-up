/**
 * Picks the backend implementation for this build (ARCHITECTURE §3.1).
 *
 * WHY:  Pages and stores depend on service interfaces only; this is the one
 *       place that decides between Supabase and the development mock (NFR-03).
 * HOW:  `createAuthService(config)` returns the Supabase implementation, or the
 *       mock when config/env.ts selected it (development builds only).
 * WHEN: Called once by App.tsx at start-up.
 * SECURITY: The mock branch is guarded by `import.meta.env.DEV`, which is the
 *       constant `false` in production builds, so the bundler drops the mock and
 *       its fictional users from deployed code entirely (checked: the mock's
 *       test emails do not appear in dist/). The Supabase client
 *       gets only the public key.
 */
import { createClient } from "@supabase/supabase-js";

import type { AppConfig } from "@/config/env";
import type { AuthService } from "@/services/interfaces/AuthService";
import { MockAuthService } from "@/services/mock/MockAuthService";
import { SupabaseAuthService } from "@/services/supabase/SupabaseAuthService";

/** Creates the auth backend for a valid configuration. */
export function createAuthService(config: Extract<AppConfig, { ok: true }>): AuthService {
  // RULE NFR-03: the mock exists only in development builds.
  if (import.meta.env.DEV && config.dataSource === "mock") {
    return new MockAuthService({ password: config.mockPassword, storage: window.localStorage });
  }
  if (config.dataSource !== "supabase") {
    throw new Error("The mock backend is not available in this build.");
  }
  const client = createClient(config.supabase.url, config.supabase.publicKey, {
    auth: {
      // Keeps the session on this device and renews it before it expires.
      persistSession: true,
      autoRefreshToken: true,
      // Reads the session from a password-reset link when it opens /reset-password.
      detectSessionInUrl: true,
      // "implicit": the reset link carries the session itself, so it works even when
      // the email opens in a different browser from the installed app (common on
      // iPhone). The PKCE flow would require the same browser that asked for the link.
      flowType: "implicit",
    },
  });
  return new SupabaseAuthService(client);
}
