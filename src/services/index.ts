/**
 * Picks the backend implementation for this build (ARCHITECTURE §3.1).
 *
 * WHY:  Pages and stores depend on service interfaces only; this is the one
 *       place that decides between Supabase and the development mock (NFR-03).
 * HOW:  `createServices(config)` returns every service (auth, products) backed
 *       by one Supabase client, or the mocks when config/env.ts selected them
 *       (development builds only).
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
import type { ProductService } from "@/services/interfaces/ProductService";
import { MockAuthService } from "@/services/mock/MockAuthService";
import { MockProductService } from "@/services/mock/MockProductService";
import { SupabaseAuthService } from "@/services/supabase/SupabaseAuthService";
import { SupabaseProductService } from "@/services/supabase/SupabaseProductService";

/** Every backend service the app uses. */
export interface Services {
  auth: AuthService;
  products: ProductService;
}

/** Creates the backend services for a valid configuration. */
export function createServices(config: Extract<AppConfig, { ok: true }>): Services {
  // RULE NFR-03: the mock exists only in development builds.
  if (import.meta.env.DEV && config.dataSource === "mock") {
    return {
      auth: new MockAuthService({ password: config.mockPassword, storage: window.localStorage }),
      products: new MockProductService(),
    };
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
  // One client for every service, so they share the signed-in session.
  return { auth: new SupabaseAuthService(client), products: new SupabaseProductService(client) };
}
