/**
 * "Back" link at the top of a page inside a tab (Q-56).
 *
 * WHY:  An installed app on iPhone has no browser Back button, so a page opened
 *       inside a tab (More → Depots, the bell, Profile) needs a visible way back.
 *       The owner decided (Q-56) that Back:
 *       - sits with the page content, not beside the logo, so the two are never
 *         confused (Fitts: no small, crowded targets in the corner);
 *       - only moves back *within* the tab, never to another tab;
 *       - never signs out (tab screens and Home have no Back at all).
 * HOW:  An arrow and the word "Back" as one large target (48px), above the page
 *       title. Two modes:
 *       - `parentOnly` (pages inside a tab, e.g. Depots): always go to the parent
 *         page in the same tab (More). History could hold another tab, so it is
 *         not used.
 *       - default (pages opened from the header: Profile, Notifications): return
 *         to the page they were opened from; when opened directly (link, refresh),
 *         go to the portal home instead of leaving the app.
 * WHEN: Rendered by MobilePortalLayout when the route declares `handle.backTo`.
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
      onClick={() => {
        if (goToParent) {
          void navigate(fallback);
        } else {
          void navigate(-1);
        }
      }}
      className="-ml-3 mb-2 inline-flex min-h-12 items-center gap-2 rounded-control px-3 text-base font-semibold text-brand hover:bg-brand-soft active:bg-brand-soft"
    >
      <ArrowLeft aria-hidden="true" className="size-5" />
      {en.nav.back}
    </button>
  );
}
