/**
 * Frame for every /distributor/* page: mobile layout with the four distributor tabs.
 *
 * WHY:  Q-46: Dashboard · Collections · Distributions · Profile (History lives inside
 *       Collections and Distributions).
 * WHEN: Loaded on demand the first time a distributor page opens (PERF-2).
 * SECURITY: Layout only; RequireRole("distributor") in router.tsx guards it (AUTH-08).
 */
import { MobilePortalLayout } from "./MobilePortalLayout";

import { DISTRIBUTOR_NAV } from "@/app/navigation";
import { en } from "@/i18n/en";

export default function DistributorLayout() {
  return (
    <MobilePortalLayout
      homeHref="/distributor"
      homeLabel={en.nav.dashboard}
      notificationsHref="/distributor/notifications"
      navItems={DISTRIBUTOR_NAV}
    />
  );
}
