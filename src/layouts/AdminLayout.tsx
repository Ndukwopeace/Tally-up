/**
 * Frame for every /admin/* page.
 *
 * WHY:  Q-47 / Q-48: the admin experience is built phone-first: four bottom tabs
 *       (Home · Collections · Distributions · More), bell and account menu at the
 *       top. A desktop layout comes later, once the phone experience is complete.
 * WHEN: Loaded on demand the first time an admin page opens (PERF-2).
 * SECURITY: Layout only; the admin role guard is added in Milestone 2 (AUTH-08).
 */
import { MobilePortalLayout } from "./MobilePortalLayout";

import { ADMIN_NAV } from "@/app/navigation";
import { en } from "@/i18n/en";

export default function AdminLayout() {
  return (
    <MobilePortalLayout
      homeHref="/admin"
      homeLabel={en.nav.home}
      notificationsHref="/admin/notifications"
      navItems={ADMIN_NAV}
      // WORKAROUND (until Milestone 2): Sign Out returns to the start page; real sign-out needs login.
      account={{ profileHref: "/admin/profile", signOutHref: "/" }}
    />
  );
}
