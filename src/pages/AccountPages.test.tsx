/**
 * Tests for Profile / My Account and signing out.
 *
 * Rules under test:
 *  - REQUIREMENTS §7 Profile: name, email, role, change password, sign out.
 *  - Q-56: Sign Out acts at once (no confirmation page) and shows
 *    "Signing out…" while it works; afterwards Back cannot reopen the portal.
 */
import { MOCK_PASSWORD } from "../../tests/helpers/mockPassword";
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

  it("Q-56: Sign Out signs out at once and opens the login page", async () => {
    const { router, service } = renderRoutes("/admin/profile", { signedInAs: admin.id, history: ["/admin"] });
    await userEvent.click(await screen.findByRole("button", { name: "Sign Out" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(await service.getAccount()).toBeNull();
    // Going back in history ends on the login page too, because the portal is guarded.
    await router.navigate(-1);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
  });

  it("Q-56: shows Signing out… while it works", async () => {
    const service = new MockAuthService({ password: MOCK_PASSWORD, signedInAs: admin.id });
    renderRoutes("/admin/profile", { service });
    const button = await screen.findByRole("button", { name: "Sign Out" });
    const release = service.holdNextCall();
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: "Signing out…" })).toBeDisabled();
    release();
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
  });
});

describe("Sign Out in the account menu", () => {
  it("Q-56: shows Signing out… in the menu, then the login page", async () => {
    const service = new MockAuthService({ password: MOCK_PASSWORD, signedInAs: admin.id });
    renderRoutes("/admin", { service });
    await userEvent.click(await screen.findByRole("button", { name: "Account" }));
    const release = service.holdNextCall();
    await userEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(screen.getByRole("button", { name: "Signing out…" })).toHaveAttribute("aria-busy", "true");
    release();
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
  });

  it("after signing in again, returns to the page the user was on (same account)", async () => {
    const { router } = renderRoutes("/admin/profile", { signedInAs: admin.id });
    await userEvent.click(await screen.findByRole("button", { name: "Sign Out" }));
    await userEvent.type(await screen.findByLabelText("Email"), admin.email);
    await userEvent.type(screen.getByLabelText("Password"), MOCK_PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Profile / My Account" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin/profile");
  });
});
