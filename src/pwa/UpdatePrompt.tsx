/**
 * Registers the service worker and offers "Reload" when a new version is ready.
 *
 * WHY:  ARCHITECTURE §11: users are told "A new version is available — Reload".
 *       The app never reloads by itself, so a half-filled form is never lost (S7).
 * HOW:  vite-plugin-pwa's useRegisterSW registers /sw.js and sets `needRefresh`
 *       when a newer build is waiting. Tapping Reload activates it and reloads.
 * WHEN: Mounted once at the root of the app (RootLayout), on every page.
 * SECURITY: The service worker caches only the app shell; registering it from
 *       bundled code (not an inline script) keeps the strict CSP in vercel.json.
 */
import { RefreshCw } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";

import { Button } from "@/components/ui/button";
import { en } from "@/i18n/en";

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-card bg-ink px-4 py-3 text-white shadow-lg"
    >
      <RefreshCw aria-hidden="true" className="size-5 shrink-0" />
      <p className="flex-1 text-sm font-medium">{en.pwa.updateAvailable}</p>
      <Button
        variant="secondary"
        onClick={() => {
          void updateServiceWorker(true);
        }}
      >
        {en.actions.reload}
      </Button>
    </div>
  );
}
