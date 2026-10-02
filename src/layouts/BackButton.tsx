/**
 * "Back" arrow shown in the header of every screen (Q-50, Q-53).
 *
 * WHY:  An installed app on iPhone has no browser or system Back button, so every
 *       screen needs a visible way back (N3, user control and freedom).
 * HOW:  Two modes:
 *       - Default (pages inside a tab): go back one step if the user arrived from
 *         another page in the app; if the page was opened directly (a link, a
 *         refresh, the first page after install), go up to the parent page instead
 *         of leaving the app.
 *       - `parentOnly` (tab screens): always go to the parent (the portal's home).
 *         Tabs replace history instead of adding to it (Q-50), so "one step back"
 *         from a tab would skip the home screen; going to the parent is predictable.
 * WHEN: Rendered by PortalHeader (from the route's `handle.backTo`) and by the
 *       Page not found screen.
 * SECURITY: Navigation only; the parent path comes from the route table, not from user input.
 */
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

import { en } from "@/i18n/en";

export function BackButton({
  fallback,
  parentOnly = false,
}: Readonly<{ fallback: string; parentOnly?: boolean }>) {
  const navigate = useNavigate();
  const location = useLocation();

  // React Router gives the very first page of a visit the key "default":
  // nothing earlier in this app to return to.
  const openedDirectly = location.key === "default";
  const goToParent = parentOnly || openedDirectly;

  return (
    <button
      type="button"
      aria-label={en.nav.back}
      onClick={() => {
        if (goToParent) {
          void navigate(fallback);
        } else {
          void navigate(-1);
        }
      }}
      className="-ml-2 inline-flex size-12 shrink-0 items-center justify-center rounded-full text-ink hover:bg-canvas"
    >
      <ArrowLeft aria-hidden="true" className="size-6" />
    </button>
  );
}
