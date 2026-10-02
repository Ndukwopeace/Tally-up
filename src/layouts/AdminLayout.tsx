/**
 * Frame for every /admin/* page.
 *
 * WHY:  Q-47 / Q-48: the admin experience is built phone-first: four bottom tabs
 *       (Home · Collections · Distributions · More), bell and account menu at the
 *       top. A desktop layout comes later, once the phone experience is complete.
 * WHEN: Loaded on demand the first time an admin page opens (PERF-2).
 * SECURITY: Layout only; RequireRole("admin") in router.tsx guards it (AUTH-08).
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
      // Sign Out opens the "Sign out?" page, the one place that ends the session.
      account={{ profileHref: "/admin/profile", signOutHref: "/admin/sign-out" }}
    />
  );
}
