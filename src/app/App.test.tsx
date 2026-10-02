/**
 * Tests for the real app root.
 *
 * Rules under test:
 *  - AUTH-07: the app opens on /login when nobody is signed in.
 *  - NFR-03 / NFR-13: a build without database settings says so instead of
 *    showing a login that cannot work.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App, startAuth } from "./App";

import { AuthStore } from "@/auth/AuthStore";
import { MockAuthService } from "@/services/mock/MockAuthService";

describe("App", () => {
  it("opens the login page at / when signed out", async () => {
    window.history.pushState({}, "", "/");
    const auth = new AuthStore(new MockAuthService());
    void auth.start();
    render(<App auth={auth} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });

  it("says the app is not connected when the build has no database settings", () => {
    expect(startAuth({ ok: false })).toBeNull();
    render(<App auth={null} />);
    expect(screen.getByRole("heading", { level: 1, name: "Tally-Up is not connected" })).toBeInTheDocument();
  });

  it("starts a store for a valid configuration", () => {
    expect(startAuth({ ok: true, dataSource: "mock" })).toBeInstanceOf(AuthStore);
    expect(
      startAuth({
        ok: true,
        dataSource: "supabase",
        supabase: { url: "https://x.supabase.co", publicKey: "k" },
      }),
    ).toBeInstanceOf(AuthStore);
  });
});
