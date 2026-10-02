/**
 * Shown instead of the app when this build has no database settings.
 *
 * WHY:  A deployed copy without Supabase settings cannot sign anyone in. Saying
 *       so plainly beats a login form that always fails (N9). It is also the
 *       first thing the owner sees if the Vercel environment variables are
 *       missing for an environment (docs/SETUP.md).
 * HOW:  Same frame as the login page; heading and one sentence. No router.
 * WHEN: config/env.ts reports `{ ok: false }`.
 * SECURITY: Does not reveal which setting is missing or any value.
 */
import { en } from "@/i18n/en";
import { AuthLayout } from "@/layouts/AuthLayout";

export function NotConnectedPage() {
  return (
    <AuthLayout title={en.config.title}>
      <div>
        <h1 className="text-2xl font-bold text-ink">{en.config.title}</h1>
        <p className="mt-1 text-base text-ink-muted">{en.config.body}</p>
      </div>
    </AuthLayout>
  );
}
