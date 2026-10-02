/**
 * Tests for the route guards and the "/" redirect.
 *
 * Rules under test:
 *  - AUTH-07: after sign-in each role lands on its own portal; "/" redirects.
 *  - AUTH-08: a role cannot open another portal's URL, including typed URLs.
 *  - ARCHITECTURE §4.5 / §13: signed-out visitors go to /login and come back to
 *    the page they asked for after signing in.
 *  - Q-55: in A1 only admins can sign in.
 */
import { MOCK_PASSWORD } from "../../tests/helpers/mockPassword";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderRoutes } from "../../tests/helpers/renderRoutes";

import { MOCK_USERS, MockAuthService } from "@/services/mock/MockAuthService";

const { admin, distributor, manager } = MOCK_USERS;

async function signInWith(email: string, password = MOCK_PASSWORD) {
  await userEvent.type(await screen.findByLabelText("Email"), email);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("the start address /", () => {
  it("sends a signed-out visitor to the login page", async () => {
    const { router } = renderRoutes("/");
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });

  it.each([
    [admin.id, "/admin"],
    [distributor.id, "/distributor"],
    [manager.id, "/depot"],
  ])("AUTH-07: sends %s to %s", async (id, home) => {
    const { router } = renderRoutes("/", { signedInAs: id });
    await screen.findAllByRole("heading", { level: 1 });
    expect(router.state.location.pathname).toBe(home);
  });
});

describe("portal guards (AUTH-08)", () => {
  it.each(["/admin", "/admin/users", "/distributor", "/depot/receipts"])(
    "a signed-out visitor to %s is sent to the login page",
    async (path) => {
      const { router } = renderRoutes(path);
      expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/login");
    },
  );

  it("returns to the requested page after signing in", async () => {
    const { router } = renderRoutes("/admin/users");
    await signInWith(admin.email);
    expect(await screen.findByRole("heading", { level: 1, name: "Users" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin/users");
  });

  it.each(["/depot", "/depot/receipts", "/distributor/collections"])(
    "an admin typing %s lands on the admin Home instead",
    async (path) => {
      const { router } = renderRoutes(path, { signedInAs: admin.id });
      expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/admin");
    },
  );

  it("a depot manager typing an admin URL lands on their own Dashboard", async () => {
    const { router } = renderRoutes("/admin/users", { signedInAs: manager.id });
    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/depot");
  });

  it("shows a loading skeleton while the saved sign-in is checked", () => {
    renderRoutes("/admin", { signedInAs: admin.id, start: false });
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("offers Try again when the check fails, and recovers", async () => {
    const service = new MockAuthService({ password: MOCK_PASSWORD, signedInAs: admin.id });
    service.failNextCallWith("unavailable");
    renderRoutes("/admin", { service });
    expect(await screen.findByText(/could not check your sign-in/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
  });

  it("the start address also offers Try again when the check fails", async () => {
    const service = new MockAuthService({ password: MOCK_PASSWORD, signedInAs: admin.id });
    service.failNextCallWith("unavailable");
    renderRoutes("/", { service });
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows the skeleton at / while checking", () => {
    renderRoutes("/", { start: false });
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });
});

describe("Q-55: admin only in A1", () => {
  it.each([distributor.email, manager.email])("refuses %s at sign-in with a plain reason", async (email) => {
    const { router } = renderRoutes("/login", { openPortals: ["admin"] });
    await signInWith(email);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign-in for your role is not open yet. Only admins can sign in for now.",
    );
    expect(router.state.location.pathname).toBe("/login");
  });

  it("ends a saved distributor session at start-up and explains why", async () => {
    const { router } = renderRoutes("/distributor", { signedInAs: distributor.id, openPortals: ["admin"] });
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in for your role is not open yet.");
    expect(router.state.location.pathname).toBe("/login");
  });
});
