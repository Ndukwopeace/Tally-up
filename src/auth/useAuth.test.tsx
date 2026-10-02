/**
 * Tests for useAuth: it must be used under AuthProvider, so a missing provider
 * fails loudly in development instead of showing a blank screen.
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAuth } from "./useAuth";

describe("useAuth", () => {
  it("throws a clear error outside <AuthProvider>", () => {
    // React logs the thrown error; keep the test output clean.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useAuth())).toThrow("useAuth must be used inside <AuthProvider>.");
    vi.restoreAllMocks();
  });
});
