/**
 * Outermost frame around every page.
 *
 * WHY:  Some things must exist on every screen exactly once: the "new version"
 *       prompt (ARCHITECTURE §11).
 * HOW:  Renders the matched route (<Outlet/>) plus the UpdatePrompt.
 * WHEN: The root route in router.tsx.
 * SECURITY: None.
 */
import { Outlet } from "react-router";

import { UpdatePrompt } from "@/pwa/UpdatePrompt";

export function RootLayout() {
  return (
    <>
      <Outlet />
      <UpdatePrompt />
    </>
  );
}
