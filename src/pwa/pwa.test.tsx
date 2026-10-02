/**
 * Tests for the PWA prompts (ARCHITECTURE §11, Milestone 1).
 *
 *  - UpdatePrompt: "A new version is available — Reload", never an automatic reload (S7).
 *  - InstallPrompt: offers installation when the browser allows it.
 */
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InstallPrompt, type BeforeInstallPromptEvent } from "./InstallPrompt";
import { UpdatePrompt } from "./UpdatePrompt";

const updateServiceWorker = vi.fn(() => Promise.resolve());
let needRefresh = false;

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefresh, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }),
}));

afterEach(() => {
  needRefresh = false;
  updateServiceWorker.mockClear();
});

describe("UpdatePrompt", () => {
  it("shows nothing when no new version is waiting", () => {
    render(<UpdatePrompt />);
    expect(screen.queryByText(/new version/)).not.toBeInTheDocument();
  });

  it("offers Reload when a new version is waiting, and reloads only when tapped", async () => {
    needRefresh = true;
    render(<UpdatePrompt />);
    expect(screen.getByRole("status")).toHaveTextContent("A new version of Tally-Up is available.");
    expect(updateServiceWorker).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });
});

// Builds the event Chrome/Android fire when the app can be installed.
function fireInstallable(outcome: "accepted" | "dismissed" = "accepted") {
  const prompt = vi.fn(() => Promise.resolve());
  const event = new Event("beforeinstallprompt", { cancelable: true }) as BeforeInstallPromptEvent;
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome, platform: "web" }) });
  act(() => {
    window.dispatchEvent(event);
  });
  return { event, prompt };
}

describe("InstallPrompt", () => {
  it("shows nothing until the browser says the app can be installed", () => {
    render(<InstallPrompt />);
    expect(screen.queryByRole("button", { name: "Install app" })).not.toBeInTheDocument();
  });

  it("takes over the browser's own banner and offers an Install button", () => {
    render(<InstallPrompt />);
    const { event } = fireInstallable();
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole("heading", { name: "Install Tally-Up on this phone" })).toBeInTheDocument();
  });

  it("opens the browser's install dialog when Install is tapped, then hides", async () => {
    render(<InstallPrompt />);
    const { prompt } = fireInstallable();
    await userEvent.click(screen.getByRole("button", { name: "Install app" }));
    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Install app" })).not.toBeInTheDocument();
  });

  it("hides when the user taps Not now", async () => {
    render(<InstallPrompt />);
    fireInstallable();
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("button", { name: "Install app" })).not.toBeInTheDocument();
  });

  it("hides once the app has been installed", () => {
    render(<InstallPrompt />);
    fireInstallable();
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(screen.queryByRole("button", { name: "Install app" })).not.toBeInTheDocument();
  });
});

describe("InstallPrompt on iPhone Safari", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("explains Share → Add to Home Screen, because Safari has no install button", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    );
    render(<InstallPrompt />);
    expect(screen.getByRole("heading", { name: "Install Tally-Up on this phone" })).toBeInTheDocument();
    expect(screen.getByText(/Tap the Share button, then “Add to Home Screen”/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByText(/Add to Home Screen/)).not.toBeInTheDocument();
  });

  it("shows nothing when already opened from the home screen", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    );
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    render(<InstallPrompt />);
    expect(screen.queryByText(/Add to Home Screen/)).not.toBeInTheDocument();
    Object.defineProperty(navigator, "standalone", { value: undefined, configurable: true });
  });
});
