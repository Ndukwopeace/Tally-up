/**
 * Frame for every /distributor/* page: mobile layout with the five distributor tabs.
 *
 * WHY:  REQUIREMENTS §7 / spec §46: Dashboard · Collections · Distributions · History · Profile.
 * WHEN: Loaded on demand the first time a distributor page opens (PERF-2).
 * SECURITY: Layout only; the distributor role guard is added in Milestone 2.
 */
import { MobilePortalLayout } from "./MobilePortalLayout";

import { DISTRIBUTOR_NAV } from "@/app/navigation";

export default function DistributorLayout() {
  return (
    <MobilePortalLayout
      homeHref="/distributor"
      notificationsHref="/distributor/notifications"
      navItems={DISTRIBUTOR_NAV}
    />
  );
}
