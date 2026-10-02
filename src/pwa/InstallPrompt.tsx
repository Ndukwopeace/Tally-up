/**
 * Offers to install Tally-Up on the phone's home screen.
 *
 * WHY:  Milestone 1 is done when the owner installs the app from the Vercel
 *       link (REQUIREMENTS §13). Distributors and depot managers use it like a
 *       normal app (NFR-05).
 * HOW:  Chrome/Android fire `beforeinstallprompt` when the app is installable.
 *       We keep that event, show our own card, and call `prompt()` when the user
 *       taps Install. The card hides after install, after "Not now", or when
 *       `appinstalled` fires. Browsers without the event (e.g. iPhone Safari)
 *       show nothing; there users use Share → Add to Home Screen.
 * WHEN: Shown on the start page (Milestone 1) and later on the login page.
 * SECURITY: The browser controls the actual install dialog; this component
 *       only asks it to appear after a user tap.
 */
import { Download } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { en } from "@/i18n/en";

/** The non-standard event Chrome fires when the app can be installed. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function InstallPrompt() {
  // The saved event; null means "nothing to offer".
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Stop the browser's own mini-banner and keep the event for our button.
    function handleInstallable(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }
    // Once installed there is nothing left to offer.
    function handleInstalled() {
      setInstallEvent(null);
    }
    window.addEventListener("beforeinstallprompt", handleInstallable);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallable);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (!installEvent) {
    return null;
  }

  // A saved event can be used once, so the card hides as soon as the dialog opens.
  function handleInstall() {
    const event = installEvent;
    setInstallEvent(null);
    void event?.prompt();
  }

  return (
    <section
      aria-labelledby="install-title"
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <Download aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-brand" />
        <div>
          <h2 id="install-title" className="text-lg font-semibold text-ink">
            {en.pwa.installTitle}
          </h2>
          <p className="text-base text-ink-muted">{en.pwa.installBody}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleInstall}>{en.actions.install}</Button>
        <Button
          variant="ghost"
          onClick={() => {
            setInstallEvent(null);
          }}
        >
          {en.actions.notNow}
        </Button>
      </div>
    </section>
  );
}
