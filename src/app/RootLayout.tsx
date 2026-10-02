/**
 * Outermost frame around every page.
 *
 * WHY:  Some things must exist on every screen exactly once: the "new version"
 *       prompt (ARCHITECTURE §11) and the loading bar for navigations (Q-56).
 * HOW:  Renders the loading bar, the matched route (<Outlet/>) and the UpdatePrompt.
 * WHEN: The root route in router.tsx.
 * SECURITY: None.
 */
import { Outlet } from "react-router";

import { NavigationProgress } from "./NavigationProgress";

import { UpdatePrompt } from "@/pwa/UpdatePrompt";

export function RootLayout() {
  return (
    <>
      <NavigationProgress />
      <Outlet />
      <UpdatePrompt />
    </>
  );
}
