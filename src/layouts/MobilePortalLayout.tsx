/**
 * Page frame shared by all three portals (phone-first, Q-48).
 *
 * WHY:  Spec §44 / UI_GUIDELINES §6: one-handed use, bottom navigation, clear
 *       connection state. One frame for every portal keeps them consistent (N4).
 * HOW:  Skip link → header (logo, bell, account) → connection banner →
 *       page content (<Outlet/>) → fixed bottom tabs. The current route may set
 *       `handle.backTo`; the page then starts with a Back link (Q-56).
 *       Content gets bottom padding so the fixed tabs never cover the last field
 *       or a focused input (WCAG 2.4.11).
 * WHEN: Wraps every /admin/*, /distributor/* and /depot/* page.
 * SECURITY: Layout only. RequireRole wraps it in router.tsx (AUTH-08).
 */
import { generatePath, Outlet, useMatches } from "react-router";

import type { AccountMenuProps } from "./AccountMenu";
import { BackButton } from "./BackButton";
import { BottomNav } from "./BottomNav";
import { PortalHeader } from "./PortalHeader";
import { SkipLink } from "./SkipLink";

import type { NavItem } from "@/app/navigation";
import { ConnectionBanner } from "@/components/common/ConnectionBanner";

/** Optional data a route can attach (React Router `handle`) to shape the frame. */
export interface RouteHandle {
  /**
   * Where Back goes; no Back when undefined (Home and tab screens, Q-56).
   * May hold the page's own parameters, e.g. "/admin/depots/:depotId".
   */
  backTo?: string;
  /** Pages inside a tab: Back always goes to `backTo`, so it never leaves the tab. */
  backToParentOnly?: boolean;
}

export interface MobilePortalLayoutProps {
  homeHref: string;
  homeLabel: string;
  notificationsHref: string;
  navItems: readonly NavItem[];
  account?: AccountMenuProps;
}

export function MobilePortalLayout({
  homeHref,
  homeLabel,
  notificationsHref,
  navItems,
  account,
}: Readonly<MobilePortalLayoutProps>) {
  // The deepest matched route decides whether Back is shown.
  const matches = useMatches();
  const deepest = matches.at(-1);
  const handle = deepest?.handle as RouteHandle | undefined;
  // Fill in parameters from the current URL (Edit depot → that depot's page).
  const backTo = handle?.backTo ? generatePath(handle.backTo, deepest?.params) : undefined;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <SkipLink />
      <PortalHeader
        homeHref={homeHref}
        homeLabel={homeLabel}
        notificationsHref={notificationsHref}
        account={account}
      />
      <ConnectionBanner />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-xl flex-1 pt-6 pr-[max(1rem,env(safe-area-inset-right))] pb-28 pl-[max(1rem,env(safe-area-inset-left))] outline-none"
      >
        {backTo ? <BackButton fallback={backTo} parentOnly={handle?.backToParentOnly} /> : null}
        <Outlet />
      </main>
      <BottomNav items={navItems} />
    </div>
  );
}
