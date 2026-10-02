/**
 * Temporary start page until login exists.
 *
 * WHY:  Login arrives in Milestone 2, but the owner must be able to open each
 *       portal and install the app from the Vercel link.
 * HOW:  Layout A (Q-54): the logo sits at the top of the screen, and the heading,
 *       portal cards and install card sit together at the bottom, within thumb
 *       reach (MB-2, Fitts). The space between them is deliberate, so a tall phone
 *       no longer shows an empty top half (UI review of the installed app).
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
      className="mx-auto flex min-h-dvh max-w-xl flex-col justify-between gap-10 bg-canvas pt-[max(1.5rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]"
    >
      <title>{en.app.name}</title>
      {/* Top: brand only. */}
      <div data-testid="start-top" className="flex min-h-16 items-center">
        <AppLogo />
      </div>
      {/* Bottom: what to do, in thumb reach. */}
      <div data-testid="start-actions" className="flex flex-col gap-6">
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
      </div>
    </main>
  );
}
