/**
 * Page frame for the phone-first portals (Distributor, Depot Manager).
 *
 * WHY:  Spec §44 / UI_GUIDELINES §6: one-handed use, bottom navigation, clear
 *       connection state. Both mobile portals share the same frame so they look
 *       and behave alike (N4).
 * HOW:  Skip link → header (logo, bell) → connection banner → page content
 *       (<Outlet/>) → fixed bottom tabs. The content gets bottom padding so the
 *       fixed tabs never cover the last field or a focused input (WCAG 2.4.11).
 * WHEN: Wraps every /distributor/* and /depot/* page.
 * SECURITY: Layout only. Role checks are added around it in Milestone 2 (AUTH-08).
 */
import { Outlet } from "react-router";

import { BottomNav } from "./BottomNav";
import { PortalHeader } from "./PortalHeader";
import { SkipLink } from "./SkipLink";

import type { NavItem } from "@/app/navigation";
import { ConnectionBanner } from "@/components/common/ConnectionBanner";

export interface MobilePortalLayoutProps {
  homeHref: string;
  notificationsHref: string;
  navItems: readonly NavItem[];
}

export function MobilePortalLayout({ homeHref, notificationsHref, navItems }: MobilePortalLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <SkipLink />
      <PortalHeader homeHref={homeHref} notificationsHref={notificationsHref} />
      <ConnectionBanner />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-xl flex-1 px-4 pt-6 pb-28 outline-none">
        <Outlet />
      </main>
      <BottomNav items={navItems} />
    </div>
  );
}
