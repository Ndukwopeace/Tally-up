/**
 * Temporary start page until login exists.
 *
 * WHY:  Login arrives in Milestone 2, but the owner must be able to open each
 *       portal and install the app from the Vercel link.
 * HOW:  One card per portal (name + one line), sitting in the lower part of the
 *       screen within thumb reach (MB-2), and the install card.
 * WHEN: At "/" until Milestone 2.
 *       WORKAROUND: Milestone 2 replaces this page with /login and deletes this file.
 * SECURITY: The portals hold no data yet, so open links expose nothing.
 *       Milestone 2 puts every portal behind login and role guards.
 */
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { AppLogo } from "@/components/common/AppLogo";
import { en } from "@/i18n/en";
import { InstallPrompt } from "@/pwa/InstallPrompt";

const PORTALS = [
  { to: "/admin", label: en.preview.admin, hint: en.preview.adminHint },
  { to: "/distributor", label: en.preview.distributor, hint: en.preview.distributorHint },
  { to: "/depot", label: en.preview.depot, hint: en.preview.depotHint },
] as const;

export function PreviewStartPage() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-xl flex-col justify-end gap-6 bg-canvas px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:justify-center"
    >
      <title>{en.app.name}</title>
      <AppLogo />
      <div>
        <h1 className="text-2xl font-bold text-ink">{en.preview.title}</h1>
        <p className="mt-1 text-base text-ink-muted">{en.preview.intro}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {PORTALS.map(({ to, label, hint }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex min-h-16 items-center justify-between gap-4 rounded-card border border-line bg-surface px-5 py-3 shadow-sm hover:border-brand"
            >
              <span>
                <span className="block text-lg font-semibold text-ink">{label}</span>
                <span className="block text-sm text-ink-muted">{hint}</span>
              </span>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <InstallPrompt />
    </main>
  );
}
