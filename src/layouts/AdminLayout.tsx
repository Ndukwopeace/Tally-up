/**
 * Frame for every /admin/* page.
 *
 * WHY:  NFR-09 / Q-40: desktop-first with a left sidebar (max 7 items); on
 *       phones the sidebar is replaced by 4 bottom tabs. Which pages go where
 *       is not decided yet (NAV-1), so both lists are empty and the sidebar says so.
 * HOW:  Wide screens (≥1024px): dark sidebar + content column. Narrow screens:
 *       header + content, and bottom tabs only once ADMIN_MOBILE_NAV has items.
 * WHEN: Loaded on demand the first time an admin page opens (PERF-2).
 * SECURITY: Layout only; the admin role guard is added in Milestone 2 (AUTH-08).
 */
import { NavLink, Outlet } from "react-router";

import { BottomNav } from "./BottomNav";
import { PortalHeader } from "./PortalHeader";
import { SkipLink } from "./SkipLink";

import { ADMIN_MOBILE_NAV, ADMIN_SIDEBAR_NAV } from "@/app/navigation";
import { AppLogo } from "@/components/common/AppLogo";
import { ConnectionBanner } from "@/components/common/ConnectionBanner";
import { en } from "@/i18n/en";
import { cn } from "@/lib/cn";

export default function AdminLayout() {
  const hasMobileTabs = ADMIN_MOBILE_NAV.length > 0;

  return (
    <div className="flex min-h-dvh bg-canvas">
      <SkipLink />
      <aside className="hidden w-64 shrink-0 flex-col gap-6 bg-sidebar px-4 py-5 lg:flex">
        <AppLogo tone="onDark" />
        {ADMIN_SIDEBAR_NAV.length > 0 ? (
          <nav aria-label={en.nav.mainLabel}>
            <ul className="flex flex-col gap-1">
              {ADMIN_SIDEBAR_NAV.map(({ label, to, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      cn(
                        "flex min-h-12 items-center gap-3 rounded-control px-3 font-semibold",
                        isActive ? "bg-brand text-white" : "text-sidebar-ink hover:bg-white/10",
                      )
                    }
                  >
                    <Icon aria-hidden="true" className="size-5" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          // RULE NAV-1: shown until the owner decides the admin navigation.
          <p className="text-sm text-sidebar-ink">{en.nav.adminPending}</p>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <PortalHeader homeHref="/admin" notificationsHref="/admin/notifications" hideLogoOnDesktop />
        <ConnectionBanner />
        <main
          id="main"
          tabIndex={-1}
          className={cn(
            "w-full max-w-7xl flex-1 px-4 pt-6 outline-none lg:px-8",
            hasMobileTabs ? "pb-28 lg:pb-8" : "pb-8",
          )}
        >
          <Outlet />
        </main>
        {hasMobileTabs ? <BottomNav items={ADMIN_MOBILE_NAV} className="lg:hidden" /> : null}
      </div>
    </div>
  );
}
