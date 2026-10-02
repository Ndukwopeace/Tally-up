/**
 * Top bar of every portal: logo on the left, notifications bell on the right.
 *
 * WHY:  J-1: users expect the back/home area top-left and the bell top-right.
 *       The bell is the only top-corner action, so nothing critical sits out of
 *       thumb reach (MB-2).
 * HOW:  The logo links to the portal home. The bell is an icon-only link with an
 *       accessible name (WCAG 1.1.1, 2.5.3) and a 48px target (F-1).
 * WHEN: Rendered by MobilePortalLayout and AdminLayout.
 * SECURITY: Links only.
 */
import { Bell } from "lucide-react";
import { Link } from "react-router";

import { AppLogo } from "@/components/common/AppLogo";
import { en } from "@/i18n/en";
import { cn } from "@/lib/cn";

export interface PortalHeaderProps {
  homeHref: string;
  notificationsHref: string;
  /** Hide the logo on wide screens where the sidebar already shows it (admin). */
  hideLogoOnDesktop?: boolean;
}

export function PortalHeader({ homeHref, notificationsHref, hideLogoOnDesktop }: PortalHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-line bg-surface px-4">
      <Link to={homeHref} className={cn("rounded-control", hideLogoOnDesktop && "lg:invisible")}>
        <AppLogo />
      </Link>
      <Link
        to={notificationsHref}
        aria-label={en.nav.notifications}
        className="inline-flex size-12 items-center justify-center rounded-full text-ink hover:bg-canvas"
      >
        <Bell aria-hidden="true" className="size-6" />
      </Link>
    </header>
  );
}
