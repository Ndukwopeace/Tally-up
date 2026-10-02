/**
 * Banner that appears when the device loses its connection.
 *
 * WHY:  v1 is online only (NFR-06). Users must know at once that saving is off,
 *       instead of tapping Submit and wondering what happened (N1, Q-22).
 * HOW:  Reads useOnlineStatus; when offline, renders a status region that
 *       screen readers announce politely (WCAG 4.1.3). Renders nothing online.
 * WHEN: At the top of every portal layout, under the header.
 * SECURITY: Informational only. No data is queued while offline, so nothing
 *       can be shown as saved without the server confirming it (NFR-06).
 */
import { WifiOff } from "lucide-react";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { en } from "@/i18n/en";

export function ConnectionBanner() {
  const online = useOnlineStatus();
  if (online) {
    return null;
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 bg-warning-soft px-4 py-3 text-sm font-semibold text-warning"
    >
      <WifiOff aria-hidden="true" className="size-5 shrink-0" />
      {en.states.offline}
    </div>
  );
}
