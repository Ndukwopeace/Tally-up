/**
 * Frame for every /depot/* page: mobile layout with the four depot-manager tabs.
 *
 * WHY:  REQUIREMENTS §7 / spec §47: Dashboard · Receipts · History · Profile;
 *       no distributor functions are shown.
 * WHEN: Loaded on demand the first time a depot page opens (PERF-2).
 * SECURITY: Layout only; RequireRole("depot_manager") in router.tsx guards it
 *       (AUTH-08). Depot-scoped data access is enforced by RLS (AUTH-10).
 */
import { MobilePortalLayout } from "./MobilePortalLayout";

import { DEPOT_NAV } from "@/app/navigation";
import { en } from "@/i18n/en";

export default function DepotLayout() {
  return (
    <MobilePortalLayout
      homeHref="/depot"
      homeLabel={en.nav.dashboard}
      notificationsHref="/depot/notifications"
      navItems={DEPOT_NAV}
    />
  );
}
