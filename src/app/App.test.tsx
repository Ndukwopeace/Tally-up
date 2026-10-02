/**
 * Tests for the real app root.
 *
 * Rules under test:
 *  - AUTH-07: the app opens on /login when nobody is signed in.
 *  - NFR-03 / NFR-13: a build without database settings says so instead of
 *    showing a login that cannot work.
 */
import { MOCK_PASSWORD } from "../../tests/helpers/mockPassword";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App, startApp } from "./App";

import { AuthStore } from "@/auth/AuthStore";
import { MockAuthService } from "@/services/mock/MockAuthService";
import { MockDepotService } from "@/services/mock/MockDepotService";
import { MockProductService } from "@/services/mock/MockProductService";
import { MockUserService } from "@/services/mock/MockUserService";

describe("App", () => {
  it("opens the login page at / when signed out", async () => {
    window.history.pushState({}, "", "/");
    const services = {
      auth: new MockAuthService({ password: MOCK_PASSWORD }),
      products: new MockProductService(),
      depots: new MockDepotService(),
      users: new MockUserService(),
    };
    const auth = new AuthStore(services.auth);
    void auth.start();
    render(<App start={{ auth, services }} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });

  it("says the app is not connected when the build has no database settings", () => {
    expect(startApp({ ok: false })).toBeNull();
    render(<App start={null} />);
    expect(screen.getByRole("heading", { level: 1, name: "Tally-Up is not connected" })).toBeInTheDocument();
  });

  it("starts the services and auth store for a valid configuration", () => {
    expect(startApp({ ok: true, dataSource: "mock", mockPassword: MOCK_PASSWORD })?.auth).toBeInstanceOf(
      AuthStore,
    );
    const supabase = startApp({
      ok: true,
      dataSource: "supabase",
      supabase: { url: "https://x.supabase.co", publicKey: "k" },
    });
    expect(supabase?.auth).toBeInstanceOf(AuthStore);
  });
});
