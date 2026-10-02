/**
 * Offers to install Tally-Up on the phone's home screen.
 *
 * WHY:  Milestone 1 is done when the owner installs the app from the Vercel
 *       link (REQUIREMENTS §13). Distributors and depot managers use it like a
 *       normal app (NFR-05).
 * HOW:  Chrome/Android fire `beforeinstallprompt` when the app is installable.
 *       We keep that event, show our own card, and call `prompt()` when the user
 *       taps Install. The card hides after install, after "Not now", or when
 *       `appinstalled` fires. iPhone Safari has no such event and no install
 *       button, so there the card explains Share → "Add to Home Screen" instead
 *       (UI review #22). Nothing is shown when the app is already installed.
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

// True on iPhone/iPad browsers, which install only through Share → Add to Home Screen.
function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

// True when the app was opened from the home screen (already installed).
function isInstalled(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // Some browsers (and the test environment) have no matchMedia; treat that as "not installed".
  const standaloneQuery =
    typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  return iosStandalone || standaloneQuery;
}

export function InstallPrompt() {
  // The saved event; null means "nothing to offer".
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  // iPhone instructions are shown once per visit until dismissed.
  const [showIosHelp, setShowIosHelp] = useState(() => isIos() && !isInstalled());

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

  if (!installEvent && !showIosHelp) {
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
          <p className="text-base text-ink-muted">{installEvent ? en.pwa.installBody : en.pwa.installIos}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {installEvent ? <Button onClick={handleInstall}>{en.actions.install}</Button> : null}
        <Button
          variant="ghost"
          onClick={() => {
            setInstallEvent(null);
            setShowIosHelp(false);
          }}
        >
          {en.actions.notNow}
        </Button>
      </div>
    </section>
  );
}
