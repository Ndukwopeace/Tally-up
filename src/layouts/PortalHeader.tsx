/**
 * Top bar of every portal.
 *
 * WHY:  J-1: users expect Back and the logo top-left, the bell (and account)
 *       top-right. Q-50: pages below the top level get a Back arrow; the logo
 *       always returns to the portal's home.
 * HOW:  Left: Back (when the page declares a parent) + logo link. Right: bell
 *       link and, for admins, the account menu. Content is limited to the same
 *       width as the page below, so edges line up on wide screens. The top
 *       padding includes the phone's status-bar area (safe-area-inset-top), so
 *       the installed app never draws under the clock and battery icons.
 * WHEN: Rendered by MobilePortalLayout on every portal page.
 * SECURITY: Links only. Access is enforced by route guards and RLS (AUTH-08, AUTH-10).
 */
import { Bell } from "lucide-react";
import { Link } from "react-router";

import { AccountMenu, type AccountMenuProps } from "./AccountMenu";
import { BackButton } from "./BackButton";

import { AppLogo } from "@/components/common/AppLogo";
import { en } from "@/i18n/en";

export interface PortalHeaderProps {
  homeHref: string;
  /** Name of the home tab, used in the logo's accessible name ("Tally-Up, go to Home"). */
  homeLabel: string;
  notificationsHref: string;
  /** Parent page for the Back arrow; no Back arrow when undefined. */
  backTo?: string;
  /** Back always goes to `backTo` (tab screens). */
  backToParentOnly?: boolean;
  /** Account menu (admin only, Q-47). */
  account?: AccountMenuProps;
}

export function PortalHeader({
  homeHref,
  homeLabel,
  notificationsHref,
  backTo,
  backToParentOnly,
  account,
}: Readonly<PortalHeaderProps>) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-16 w-full max-w-xl items-center justify-between gap-2 pr-[max(0.5rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
        <div className="flex min-w-0 items-center gap-1">
          {backTo ? <BackButton fallback={backTo} parentOnly={backToParentOnly} /> : null}
          <Link to={homeHref} aria-label={en.nav.logoHome(homeLabel)} className="rounded-control">
            <AppLogo />
          </Link>
        </div>
        <div className="flex items-center">
          <Link
            to={notificationsHref}
            aria-label={en.nav.notifications}
            className="inline-flex size-12 items-center justify-center rounded-full text-ink hover:bg-canvas"
          >
            <Bell aria-hidden="true" className="size-6" />
          </Link>
          {account ? <AccountMenu {...account} /> : null}
        </div>
      </div>
    </header>
  );
}
