/**
 * Picks the Supabase project URL and *public* key for the browser build.
 *
 * WHY:  The Vercel Marketplace Supabase integration creates the environment
 *       variables itself (ARCHITECTURE §15), with names meant for other
 *       frameworks (e.g. NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ANON_KEY). Vite only
 *       exposes VITE_* names to the browser. Rather than asking the owner to copy
 *       keys by hand, the build reads whichever accepted name exists.
 * HOW:  Looks through a fixed list of names in order and takes the first one
 *       set, then checks the key really is a public one.
 * WHEN: Called once by vite.config.ts at the start of every build and dev run.
 * SECURITY: Only the anon / publishable key may reach the browser; RLS protects
 *       the data it can reach (ARCHITECTURE §14). A secret key would bypass RLS
 *       for anyone who opens the app, so if the chosen value is a new-style
 *       secret key ("sb_secret_…") or a JWT for any role other than "anon", the
 *       build fails with an error instead of shipping it (SEC-4). The privileged
 *       key's variable name is deliberately absent from the lists below.
 */

/** Accepted names for the project URL, in order of preference. */
const URL_NAMES = ["VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"] as const;

/** Accepted names for the public key, in order of preference. */
const PUBLIC_KEY_NAMES = [
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
] as const;

export interface PublicSupabaseEnv {
  /** Project URL, or "" when not configured. */
  url: string;
  /** Public (anon / publishable) key, or "" when not configured. */
  publicKey: string;
}

// First non-empty value among `names`, trimmed (dashboard pastes often carry a trailing newline).
function firstSet(env: Readonly<Record<string, string | undefined>>, names: readonly string[]): string {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

// The `role` claim of a JWT-shaped key, or null if the value is not a readable JWT.
function jwtRole(key: string): string | null {
  const parts = key.split(".");
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }
  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (typeof payload === "object" && payload !== null && "role" in payload) {
      return String(payload.role);
    }
    return null;
  } catch {
    // Not a JWT; new-style keys are plain strings.
    return null;
  }
}

/** Reads the URL and public key from `env` (usually process.env + .env files). */
export function resolvePublicSupabaseEnv(
  env: Readonly<Record<string, string | undefined>>,
): PublicSupabaseEnv {
  const url = firstSet(env, URL_NAMES);
  const publicKey = firstSet(env, PUBLIC_KEY_NAMES);

  // SECURITY: refuse to put a privileged key into code every visitor downloads.
  const role = jwtRole(publicKey);
  if (publicKey.startsWith("sb_secret_") || (role !== null && role !== "anon")) {
    throw new Error(
      "Build stopped: the Supabase key found for the browser is a secret key. " +
        "Set the anon / publishable key instead, and rotate the secret key if it was exposed.",
    );
  }

  return { url, publicKey };
}
