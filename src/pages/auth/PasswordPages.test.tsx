/**
 * Tests for forgot password, reset password and the shared new-password form.
 *
 * Rules under test:
 *  - AUTH-01 / AUTH-06: /forgot-password sends a reset email whose link opens
 *    /reset-password; the answer never reveals whether the email has an account.
 *  - AUTH-09 / Q-55: refused accounts never reach the new-password form.
 *  - Q-53: Back arrow on these screens.
 *  - NFR-06: no sending while offline.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderRoutes } from "../../../tests/helpers/renderRoutes";

import { MOCK_PASSWORD, MOCK_USERS, MockAuthService } from "@/services/mock/MockAuthService";

const { admin, distributor } = MOCK_USERS;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("forgot password", () => {
  it("is reached from the login page and has Back to it", async () => {
    const { router } = renderRoutes("/login");
    await userEvent.click(await screen.findByRole("link", { name: "Forgot password?" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Reset your password" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/login");
  });

  it("checks the email first", async () => {
    renderRoutes("/forgot-password");
    await userEvent.click(await screen.findByRole("button", { name: "Send reset link" }));
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Enter your email address.");
    expect(screen.getByLabelText("Email")).toHaveFocus();
  });

  it("AUTH-06: requests a link to /reset-password and confirms without revealing the account", async () => {
    const { service } = renderRoutes("/forgot-password");
    await userEvent.type(await screen.findByLabelText("Email"), " someone@tallyup.test ");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "If someone@tallyup.test has a Tally-Up account, a reset link is on its way.",
    );
    expect(service.resetRequests).toEqual([
      { email: "someone@tallyup.test", redirectTo: `${window.location.origin}/reset-password` },
    ]);
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
  });

  it("explains a refusal, e.g. too many requests", async () => {
    const service = new MockAuthService();
    renderRoutes("/forgot-password", { service });
    await userEvent.type(await screen.findByLabelText("Email"), "a@tallyup.test");
    service.failNextCallWith("rate_limited");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts.");
  });

  it("NFR-06: cannot send while offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderRoutes("/forgot-password");
    expect(await screen.findByRole("button", { name: "Send reset link" })).toBeDisabled();
  });
});

describe("reset password (link from the email)", () => {
  it("explains an expired or used link and offers a new one", async () => {
    const { router } = renderRoutes("/reset-password");
    expect(
      await screen.findByRole("heading", { level: 1, name: "This link no longer works" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Ask for a new link" }));
    expect(router.state.location.pathname).toBe("/forgot-password");
  });

  it("Q-55: tells a refused account why instead of showing the form", async () => {
    renderRoutes("/reset-password", { signedInAs: distributor.id, openPortals: ["admin"] });
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in for your role is not open yet.");
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("sets a new password, then continues into the app", async () => {
    const { router, service } = renderRoutes("/reset-password", { signedInAs: admin.id });
    await userEvent.type(await screen.findByLabelText("New password"), "fresh-pass-9");
    await userEvent.type(screen.getByLabelText("Repeat new password"), "fresh-pass-9");
    await userEvent.click(screen.getByRole("button", { name: "Save new password" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Your password has been changed.");
    await userEvent.click(screen.getByRole("link", { name: "Continue" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin");
    await service.signOut();
    await expect(service.signInWithPassword(admin.email, "fresh-pass-9")).resolves.toEqual(admin);
  });

  it("asks for the password twice and explains each problem", async () => {
    renderRoutes("/reset-password", { signedInAs: admin.id });
    await userEvent.click(await screen.findByRole("button", { name: "Save new password" }));
    expect(screen.getByLabelText("New password")).toHaveAccessibleDescription("Enter a new password.");
    expect(screen.getByLabelText("New password")).toHaveFocus();
    await userEvent.type(screen.getByLabelText("New password"), "fresh-pass-9");
    await userEvent.type(screen.getByLabelText("Repeat new password"), "fresh-pass-8");
    await userEvent.click(screen.getByRole("button", { name: "Save new password" }));
    expect(screen.getByLabelText("Repeat new password")).toHaveAccessibleDescription(
      "The two passwords do not match.",
    );
    expect(screen.getByLabelText("Repeat new password")).toHaveFocus();
  });

  it("shows Supabase's refusal in plain words", async () => {
    renderRoutes("/reset-password", { signedInAs: admin.id });
    await userEvent.type(await screen.findByLabelText("New password"), MOCK_PASSWORD);
    await userEvent.type(screen.getByLabelText("Repeat new password"), MOCK_PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Save new password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The new password must be different from your current one.",
    );
  });

  it("offers Try again if the link could not be checked", async () => {
    const service = new MockAuthService({ signedInAs: admin.id });
    service.failNextCallWith("unavailable");
    renderRoutes("/reset-password", { service });
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows a skeleton while the link is being checked", () => {
    renderRoutes("/reset-password", { start: false });
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });
});
