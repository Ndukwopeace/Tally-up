/**
 * Frame for every /depot/* page: mobile layout with the four depot-manager tabs.
 *
 * WHY:  REQUIREMENTS §7 / spec §47: Dashboard · Receipts · History · Profile;
 *       no distributor functions are shown.
 * WHEN: Loaded on demand the first time a depot page opens (PERF-2).
 * SECURITY: Layout only; the depot-manager role guard and depot-scoped data
 *       access are added in Milestone 2 (AUTH-08, AUTH-10).
 */
import { MobilePortalLayout } from "./MobilePortalLayout";

import { DEPOT_NAV } from "@/app/navigation";

export default function DepotLayout() {
  return (
    <MobilePortalLayout homeHref="/depot" notificationsHref="/depot/notifications" navItems={DEPOT_NAV} />
  );
}
