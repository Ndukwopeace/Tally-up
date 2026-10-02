/**
 * Thin bar at the very top while a screen is loading.
 *
 * WHY:  Q-56: every action shows an indicator. A tap on a link or tab whose
 *       screen still has to download (the first visit to a portal, PERF-2)
 *       would otherwise look like nothing happened (N1, D-1).
 * HOW:  Reads React Router's navigation state. While it is not "idle", a
 *       status region shows a sliding bar (and "Loading…" for screen readers).
 *       Nothing is drawn when idle, so instant navigations show no flicker.
 * WHEN: Rendered once by RootLayout, above every page.
 * SECURITY: Display only.
 */
import { useNavigation } from "react-router";

import { en } from "@/i18n/en";

export function NavigationProgress() {
  const navigation = useNavigation();
  if (navigation.state === "idle") {
    return null;
  }
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-brand-soft">
      <span className="sr-only">{en.states.loading}</span>
      <div aria-hidden="true" className="h-full w-2/5 animate-progress bg-brand" />
    </div>
  );
}
