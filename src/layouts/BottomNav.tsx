/**
 * Bottom tab bar for phone-sized screens.
 *
 * WHY:  REQUIREMENTS §7 and J-1: mobile portals use bottom tabs, which sit in
 *       the thumb zone (MB-2, F-2). Max 5 tabs (H-2).
 * HOW:  A <nav> landmark with one NavLink per item. NavLink sets
 *       aria-current="page" on the active tab, which also drives its styling.
 *       Each tab is icon + text (UI_GUIDELINES §8) and at least 64px tall.
 *       Tabs share the width equally; a label too long for a narrow phone
 *       (e.g. "Distributions" at 320px) wraps instead of pushing other tabs
 *       below the 48px minimum or off screen (F-1, WCAG 1.4.10 reflow).
 * WHEN: Distributor and Depot Manager layouts; Admin phone layout once NAV-1 is decided.
 * SECURITY: Navigation only. Access is enforced by route guards and RLS (AUTH-08, AUTH-10).
 */
import { NavLink } from "react-router";

import type { NavItem } from "@/app/navigation";
import { en } from "@/i18n/en";
import { cn } from "@/lib/cn";

export function BottomNav({ items, className }: { items: readonly NavItem[]; className?: string }) {
  return (
    <nav
      aria-label={en.nav.mainLabel}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <ul className="mx-auto flex max-w-xl">
        {items.map(({ label, to, icon: Icon, end }) => (
          <li key={to} className="min-w-0 flex-1 basis-0">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-center text-xs leading-tight font-semibold",
                  isActive ? "text-brand" : "text-ink-muted hover:text-ink",
                )
              }
            >
              <Icon aria-hidden="true" className="size-6 shrink-0" />
              <span className="max-w-full hyphens-auto [overflow-wrap:anywhere]">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
