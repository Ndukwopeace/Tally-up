/**
 * Tells components whether the device currently has a network connection.
 *
 * WHY:  v1 is online only (NFR-06). Screens must say "No connection" and submit
 *       buttons must be disabled instead of pretending to save.
 * HOW:  Subscribes to the browser's `online` / `offline` events through React's
 *       useSyncExternalStore, so every component sees the same value.
 * WHEN: Used by ConnectionBanner and, from Milestone 4, by every submit button.
 * SECURITY: Read-only browser signal. It can report "online" when a network is
 *       present but the server is unreachable, so services still handle request
 *       failures; this hook is a hint, not a guarantee.
 */
import { useSyncExternalStore } from "react";

// Registers a listener for connection changes and returns the clean-up function React calls on unmount.
function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

// Current value read by React on every render and after every event.
function getSnapshot(): boolean {
  return navigator.onLine;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
