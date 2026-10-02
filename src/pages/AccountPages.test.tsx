/**
 * Tests for Profile / My Account and the "Sign out?" page.
 *
 * Rules under test:
 *  - REQUIREMENTS §7 Profile: name, email, role, change password, sign out.
 *  - Q-47: Sign Out from the account menu ends the session.
 *  - Q-53: Back on Home leads to "Sign out?"; "Stay signed in" returns.
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderRoutes } from "../../tests/helpers/renderRoutes";

import { MOCK_USERS, MockAuthService } from "@/services/mock/MockAuthService";

const { admin } = MOCK_USERS;

describe("Profile / My Account", () => {
  it("shows the signed-in admin's name, email and role", async () => {
    renderRoutes("/admin/profile", { signedInAs: admin.id });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Profile / My Account" }),
    ).toBeInTheDocument();
    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    const values = screen.getAllByRole("definition").map((value) => value.textContent);
    expect(terms).toEqual(["Name", "Email", "Role"]);
    expect(values).toEqual(["Ama Admin", admin.email, "Admin"]);
  });

  it("changes the password and confirms it", async () => {
    renderRoutes("/admin/profile", { signedInAs: admin.id });
    await userEvent.type(await screen.findByLabelText("New password"), "fresh-pass-9");
    await userEvent.type(screen.getByLabelText("Repeat new password"), "fresh-pass-9");
    await userEvent.click(screen.getByRole("button", { name: "Save new password" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Your password has been changed.");
    expect(screen.getByLabelText("New password")).toHaveValue("");
  });

  it("offers Sign Out, which asks for confirmation", async () => {
    const { router } = renderRoutes("/admin/profile", { signedInAs: admin.id });
    await userEvent.click(await screen.findByRole("link", { name: "Sign Out" }));
    expect(router.state.location.pathname).toBe("/admin/sign-out");
  });
});

describe("Sign out?", () => {
  it("signs out, opens the login page and leaves no way back into the portal", async () => {
    const { router, service } = renderRoutes("/admin/sign-out", {
      signedInAs: admin.id,
      history: ["/admin"],
    });
    await userEvent.click(await screen.findByRole("button", { name: "Sign Out" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(await service.getAccount()).toBeNull();
    // Even going back in history ends on the login page, because the portal is guarded.
    await router.navigate(-1);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
  });

  it("shows Signing out… while it works", async () => {
    const service = new MockAuthService({ signedInAs: admin.id });
    renderRoutes("/admin/sign-out", { service });
    const button = await screen.findByRole("button", { name: "Sign Out" });
    const release = service.holdNextCall();
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: "Signing out…" })).toBeDisabled();
    release();
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
  });

  it("'Stay signed in' returns to Home", async () => {
    const { router } = renderRoutes("/admin/sign-out", { signedInAs: admin.id });
    await userEvent.click(await screen.findByRole("link", { name: "Stay signed in" }));
    expect(router.state.location.pathname).toBe("/admin");
  });

  it("Back returns to where the user came from", async () => {
    const { router } = renderRoutes("/admin/sign-out", { signedInAs: admin.id, history: ["/admin/more"] });
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/admin/more");
  });

  it("after signing in again, never lands back on the sign-out page", async () => {
    const { router } = renderRoutes("/admin/sign-out");
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Email"), admin.email);
    await userEvent.type(screen.getByLabelText("Password"), "tally-demo-1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin");
  });
});
