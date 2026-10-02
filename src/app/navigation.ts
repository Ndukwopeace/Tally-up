/**
 * Navigation items for each portal.
 *
 * WHY:  The owner fixed the tabs (Q-46, Q-47, REQUIREMENTS §7). Keeping them as
 *       data (not hard-coded in layouts) means the tab limits are tested and a
 *       change is a one-line edit with a decision-log entry.
 * HOW:  Each item has a label (from i18n), a path, a Lucide icon, `end` for a
 *       portal home (active only on its own page) and `activeFor` for a tab that
 *       stays active on the pages it opens (More → Depots, …).
 * WHEN: Read by the portal layouts (src/layouts/) and the admin More page.
 * SECURITY: Hiding a link is not access control. Route guards (RequireRole)
 *       and Row Level Security enforce who can open what (AUTH-08, AUTH-10).
 */
import {
  Boxes,
  ChartColumn,
  CircleUser,
  ClipboardCheck,
  Croissant,
  History,
  House,
  LayoutDashboard,
  Menu,
  Package,
  ScrollText,
  Send,
  Settings,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import { en } from "@/i18n/en";

export interface NavItem {
  /** Visible text under the icon (icon + text, UI_GUIDELINES §8). */
  readonly label: string;
  /** Route the item opens. */
  readonly to: string;
  readonly icon: LucideIcon;
  /** True for a portal's home: active only on that exact path. */
  readonly end?: boolean;
  /** Other paths on which this tab also counts as active (e.g. More → Depots). */
  readonly activeFor?: readonly string[];
}

/** A row on the admin More page: a nav item plus one line saying what it holds. */
export interface MoreItem extends NavItem {
  readonly description: string;
}

/** RULE H-2: mobile bottom navigation never has more than 5 tabs. */
export const MAX_BOTTOM_TABS = 5;
/** RULE Q-40 / Q-47: admin phone bottom navigation has 4 tabs. */
export const MAX_ADMIN_MOBILE_TABS = 4;

/** RULE Q-47 / Q-51: the pages opened from the admin More tab. */
export const ADMIN_MORE_ITEMS: readonly MoreItem[] = [
  { label: en.nav.depots, to: "/admin/depots", icon: Warehouse, description: en.more.depots },
  { label: en.nav.products, to: "/admin/products", icon: Croissant, description: en.more.products },
  { label: en.nav.users, to: "/admin/users", icon: Users, description: en.more.users },
  { label: en.nav.reports, to: "/admin/reports", icon: ChartColumn, description: en.more.reports },
  { label: en.nav.audit, to: "/admin/audit", icon: ScrollText, description: en.more.audit },
  { label: en.nav.settings, to: "/admin/settings", icon: Settings, description: en.more.settings },
];

/** RULE Q-47: Home · Collections · Distributions · More. */
export const ADMIN_NAV: readonly NavItem[] = [
  { label: en.nav.home, to: "/admin", icon: House, end: true },
  { label: en.nav.collections, to: "/admin/collections", icon: Package },
  { label: en.nav.distributions, to: "/admin/distributions", icon: Truck },
  {
    label: en.nav.more,
    to: "/admin/more",
    icon: Menu,
    activeFor: ADMIN_MORE_ITEMS.map((item) => item.to),
  },
];

/** RULE Q-46: Dashboard · Collections · Distributions · Profile. History lives inside Collections and Distributions. */
export const DISTRIBUTOR_NAV: readonly NavItem[] = [
  { label: en.nav.dashboard, to: "/distributor", icon: LayoutDashboard, end: true },
  { label: en.nav.collections, to: "/distributor/collections", icon: Boxes },
  { label: en.nav.distributions, to: "/distributor/distributions", icon: Send },
  { label: en.nav.profile, to: "/distributor/profile", icon: CircleUser },
];

/** RULE REQUIREMENTS §7: Dashboard · Receipts · History · Profile. */
export const DEPOT_NAV: readonly NavItem[] = [
  { label: en.nav.dashboard, to: "/depot", icon: LayoutDashboard, end: true },
  { label: en.nav.receipts, to: "/depot/receipts", icon: ClipboardCheck },
  { label: en.nav.history, to: "/depot/history", icon: History },
  { label: en.nav.profile, to: "/depot/profile", icon: CircleUser },
];
