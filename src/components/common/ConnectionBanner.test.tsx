/**
 * Tests for useOnlineStatus and ConnectionBanner.
 *
 * Rules under test:
 *  - NFR-06: online only in v1; offline screens say "No connection".
 *  - N1: visibility of system status. WCAG 4.1.3: status messages are announced.
 */
import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectionBanner } from "./ConnectionBanner";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

function setOnline(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useOnlineStatus", () => {
  it("starts from the browser's current state", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it("follows online and offline events", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
    act(() => {
      setOnline(false);
    });
    expect(result.current).toBe(false);
    act(() => {
      setOnline(true);
    });
    expect(result.current).toBe(true);
  });
});

describe("ConnectionBanner", () => {
  it("shows nothing while online", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<ConnectionBanner />);
    expect(screen.queryByText(/No connection/)).not.toBeInTheDocument();
  });

  it("announces 'No connection' when the phone goes offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<ConnectionBanner />);
    act(() => {
      setOnline(false);
    });
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("No connection.");
  });
});
