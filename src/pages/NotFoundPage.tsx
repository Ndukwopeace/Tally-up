/**
 * Shown for any address that does not exist.
 *
 * WHY:  N9: a clear message and a way back. Branded like the rest of the app
 *       (UI review #21), with the way back as a real button.
 * HOW:  Back arrow (Q-53, like every screen), logo, heading, short explanation,
 *       button to the start page.
 * WHEN: React Router's catch-all route ("*").
 * SECURITY: From Milestone 2, records a user may not see also show "Not found",
 *       so the app never confirms that a forbidden record exists (ARCHITECTURE §4.5).
 */
import { Link } from "react-router";

import { AppLogo } from "@/components/common/AppLogo";
import { BackButton } from "@/layouts/BackButton";
import { buttonVariants } from "@/components/ui/button";
import { en } from "@/i18n/en";

export function NotFoundPage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-4">
      <title>{`${en.pages.notFoundTitle} · ${en.app.name}`}</title>
      <div className="fixed top-0 left-0 pt-[env(safe-area-inset-top)] pl-[max(0.5rem,env(safe-area-inset-left))]">
        <div className="flex min-h-16 items-center pl-2">
          <BackButton fallback="/" />
        </div>
      </div>
      <AppLogo />
      <div>
        <h1 className="text-2xl font-bold text-ink">{en.pages.notFoundTitle}</h1>
        <p className="mt-1 text-base text-ink-muted">{en.pages.notFoundBody}</p>
      </div>
      <Link to="/" className={buttonVariants({ variant: "secondary", className: "self-start" })}>
        {en.pages.notFoundAction}
      </Link>
    </main>
  );
}
