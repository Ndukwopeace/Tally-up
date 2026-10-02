/**
 * Navigation items for each portal.
 *
 * WHY:  REQUIREMENTS §7 fixes the Distributor and Depot Manager tabs; Q-40 caps
 *       Admin at 7 sidebar items and 4 phone tabs. Keeping them as data (not
 *       hard-coded in layouts) means the limits are tested and NAV-1 can be
 *       filled in later by editing one list.
 * HOW:  Each item has a label (from i18n), a path, a Lucide icon, and `end`
 *       for the portal home so the Dashboard tab is active only on its own page.
 * WHEN: Read by the portal layouts (src/layouts/) to draw bottom tabs and the sidebar.
 * SECURITY: Hiding a link is not access control. Route guards (Milestone 2)
 *       and Row Level Security enforce who can open what (AUTH-08, AUTH-10).
 */
import {
  Boxes,
  CircleUser,
  ClipboardCheck,
  History,
  LayoutDashboard,
  Send,
  type LucideIcon,
} from "lucide-react";

import { en } from "@/i18n/en";

export interface NavItem {
  /** Visible text under/next to the icon (icon + text, UI_GUIDELINES §8). */
  readonly label: string;
  /** Route the item opens. */
  readonly to: string;
  readonly icon: LucideIcon;
  /** True for a portal's home: active only on that exact path. */
  readonly end?: boolean;
}

/** RULE H-2: mobile bottom navigation never has more than 5 tabs. */
export const MAX_BOTTOM_TABS = 5;
/** RULE Q-40: admin desktop sidebar has at most 7 items. */
export const MAX_ADMIN_SIDEBAR_ITEMS = 7;
/** RULE Q-40: admin phone bottom navigation has 4 tabs. */
export const MAX_ADMIN_MOBILE_TABS = 4;

/** RULE REQUIREMENTS §7: Dashboard · Collections · Distributions · History · Profile. */
export const DISTRIBUTOR_NAV: readonly NavItem[] = [
  { label: en.nav.dashboard, to: "/distributor", icon: LayoutDashboard, end: true },
  { label: en.nav.collections, to: "/distributor/collections", icon: Boxes },
  { label: en.nav.distributions, to: "/distributor/distributions", icon: Send },
  { label: en.nav.history, to: "/distributor/history", icon: History },
  { label: en.nav.profile, to: "/distributor/profile", icon: CircleUser },
];

/** RULE REQUIREMENTS §7: Dashboard · Receipts · History · Profile. */
export const DEPOT_NAV: readonly NavItem[] = [
  { label: en.nav.dashboard, to: "/depot", icon: LayoutDashboard, end: true },
  { label: en.nav.receipts, to: "/depot/receipts", icon: ClipboardCheck },
  { label: en.nav.history, to: "/depot/history", icon: History },
  { label: en.nav.profile, to: "/depot/profile", icon: CircleUser },
];

/** RULE NAV-1: contents decided by the owner before Milestone 3. Empty until then. */
export const ADMIN_SIDEBAR_NAV: readonly NavItem[] = [];

/** RULE NAV-1: contents decided by the owner before Milestone 3. Empty until then. */
export const ADMIN_MOBILE_NAV: readonly NavItem[] = [];
