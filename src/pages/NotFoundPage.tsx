/**
 * Shown for any address that does not exist.
 *
 * WHY:  N9: a clear message and a way back, instead of a blank or broken screen.
 * HOW:  Heading, short explanation, link to the start page.
 * WHEN: React Router's catch-all route ("*").
 * SECURITY: From Milestone 2, records a user may not see also show "Not found",
 *       so the app never confirms that a forbidden record exists (ARCHITECTURE §4.5).
 */
import { Link } from "react-router";

import { en } from "@/i18n/en";

export function NotFoundPage() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-4 px-4"
    >
      <title>{`${en.pages.notFoundTitle} · ${en.app.name}`}</title>
      <h1 className="text-2xl font-bold text-ink">{en.pages.notFoundTitle}</h1>
      <p className="text-base text-ink-muted">{en.pages.notFoundBody}</p>
      <Link
        to="/"
        className="inline-flex min-h-12 items-center font-semibold text-brand underline underline-offset-4"
      >
        {en.pages.notFoundAction}
      </Link>
    </main>
  );
}
