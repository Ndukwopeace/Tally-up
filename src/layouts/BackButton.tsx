/**
 * "Back" arrow shown in the header on every page below a portal's top level.
 *
 * WHY:  Q-50: the owner needs a visible way back to the previous page. Pages
 *       reached from More, the bell or the account menu are not tabs, so they
 *       need their own way out (N3, user control and freedom).
 * HOW:  If the user arrived from another page in the app, go back one step.
 *       If the page was opened directly (a link, a refresh, the first page after
 *       install), there is no previous app page, so go up to the parent page
 *       instead of leaving the app.
 * WHEN: Rendered by PortalHeader when the current route declares `handle.backTo`.
 * SECURITY: Navigation only; the parent path comes from the route table, not from user input.
 */
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

import { en } from "@/i18n/en";

export function BackButton({ fallback }: { fallback: string }) {
  const navigate = useNavigate();
  const location = useLocation();

  // React Router gives the very first page of a visit the key "default":
  // nothing earlier in this app to return to.
  const openedDirectly = location.key === "default";

  return (
    <button
      type="button"
      aria-label={en.nav.back}
      onClick={() => {
        if (openedDirectly) {
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
