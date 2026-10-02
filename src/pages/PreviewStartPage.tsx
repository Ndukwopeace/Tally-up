/**
 * Temporary start page for Milestone 1.
 *
 * WHY:  Login does not exist until Milestone 2, but the owner must be able to open
 *       each portal frame and install the app from the Vercel link (REQUIREMENTS §13).
 * HOW:  Links to the three portals and the install card.
 * WHEN: At "/" during Milestone 1 only.
 *       WORKAROUND: Milestone 2 replaces this page with /login and deletes this file.
 * SECURITY: The portals contain no data in Milestone 1, so open links expose
 *       nothing. Milestone 2 puts every portal behind login and role guards.
 */
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

import { AppLogo } from "@/components/common/AppLogo";
import { en } from "@/i18n/en";
import { InstallPrompt } from "@/pwa/InstallPrompt";

const PORTALS = [
  { to: "/admin", label: en.preview.adminLink },
  { to: "/distributor", label: en.preview.distributorLink },
  { to: "/depot", label: en.preview.depotLink },
] as const;

export function PreviewStartPage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 bg-canvas px-4 py-10">
      <title>{en.preview.title}</title>
      <AppLogo />
      <div>
        <h1 className="text-3xl font-bold text-ink">{en.preview.title}</h1>
        <p className="mt-2 text-base text-ink-muted">{en.preview.intro}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {PORTALS.map(({ to, label }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex min-h-14 items-center justify-between rounded-card border border-line bg-surface px-5 text-lg font-semibold text-ink hover:border-brand"
            >
              {label}
              <ArrowRight aria-hidden="true" className="size-5 text-brand" />
            </Link>
          </li>
        ))}
      </ul>
      <InstallPrompt />
    </main>
  );
}
