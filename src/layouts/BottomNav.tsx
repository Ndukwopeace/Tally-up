/**
 * Bottom tab bar.
 *
 * WHY:  Q-46 / Q-47 / REQUIREMENTS §7: every portal uses bottom tabs in the
 *       thumb zone (MB-2, F-2). Max 5 tabs (H-2).
 * HOW:  One link per tab, sharing the width equally.
 *       - Active tab: blue pill behind the icon + bold blue label, so it is not
 *         shown by colour alone (WCAG 1.4.1), and aria-current="page".
 *       - A tab is active on its own path, on paths below it, and on any path
 *         listed in `activeFor` (More stays active on Depots, Products, …).
 *       - Tabs REPLACE the current history entry instead of adding one, so the
 *         phone's back-swipe does not walk through previously tapped tabs (Q-50).
 *       - Padding includes the phone's safe areas (home indicator, rounded corners).
 * WHEN: Every portal layout.
 * SECURITY: Navigation only. Access is enforced by route guards and RLS (AUTH-08, AUTH-10).
 */
import { Link, useLocation } from "react-router";

import type { NavItem } from "@/app/navigation";
import { en } from "@/i18n/en";
import { cn } from "@/lib/cn";

// True when `pathname` is `path` itself or a page below it.
function isUnder(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.activeFor?.some((path) => isUnder(pathname, path))) {
    return true;
  }
  return item.end ? pathname === item.to : isUnder(pathname, item.to);
}

export function BottomNav({ items }: { items: readonly NavItem[] }) {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label={en.nav.mainLabel}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
    >
      <ul className="mx-auto flex max-w-xl">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.to} className="min-w-0 flex-1 basis-0">
              <Link
                to={item.to}
                replace
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-xs leading-tight whitespace-nowrap max-[359px]:text-[11px]",
                  active ? "font-bold text-brand" : "font-medium text-ink-muted hover:text-ink",
                )}
              >
                <span className="relative flex h-8 w-14 items-center justify-center">
                  {active ? (
                    <span
                      data-active-marker
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-brand-soft"
                    />
                  ) : null}
                  <Icon aria-hidden="true" className="relative size-6" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
