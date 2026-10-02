/**
 * Tests for the login page.
 *
 * Rules under test:
 *  - AUTH-01 / AUTH-03: /login with email + password; no signup link (AUTH-02).
 *  - AUTH-04 / AUTH-09: refusals in plain words; same message for an unknown
 *    email and a wrong password (no account probing).
 *  - AUTH-05: Google shown but disabled, "Not available yet".
 *  - AUD-03: a successful login is recorded.
 *  - NFR-06: no sign-in while offline. WCAG 3.3.1: field errors, focus moves.
 *  - Q-54: layout A (logo top, form at the bottom).
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderRoutes } from "../../../tests/helpers/renderRoutes";

import { MOCK_PASSWORD, MOCK_USERS, MockAuthService } from "@/services/mock/MockAuthService";

const { admin, inactiveAdmin } = MOCK_USERS;

afterEach(() => {
  vi.restoreAllMocks();
});

async function fillAndSubmit(email: string, password: string) {
  const emailField = await screen.findByLabelText("Email");
  if (email) {
    await userEvent.type(emailField, email);
  }
  if (password) {
    await userEvent.type(screen.getByLabelText("Password"), password);
  }
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("login page", () => {
  it("asks for email and password, offers Forgot password and no signup", async () => {
    renderRoutes("/login");
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(screen.queryByText(/sign up|create account|register/i)).not.toBeInTheDocument();
    expect(document.title).toBe("Sign in · Tally-Up");
  });

  it("AUTH-05: shows Google as not available yet", async () => {
    renderRoutes("/login");
    const google = await screen.findByRole("button", { name: "Continue with Google" });
    expect(google).toBeDisabled();
    expect(google).toHaveAccessibleDescription("Not available yet");
  });

  it("Q-54: keeps the logo at the top and the form at the bottom", async () => {
    renderRoutes("/login");
    const heading = await screen.findByRole("heading", { level: 1, name: "Sign in" });
    expect(screen.getByTestId("auth-top")).toContainElement(screen.getByText("Tally-"));
    expect(screen.getByTestId("auth-content")).toContainElement(heading);
    // The login page is where the app starts, so it has no Back arrow.
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("explains empty fields and focuses the first one", async () => {
    renderRoutes("/login");
    await fillAndSubmit("", "");
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Enter your email address.");
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Enter your password.");
    expect(screen.getByLabelText("Email")).toHaveFocus();
  });

  it("checks the email format before sending anything", async () => {
    renderRoutes("/login");
    await fillAndSubmit("ama", MOCK_PASSWORD);
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      "Enter an email address like name@example.com.",
    );
  });

  it("moves focus to the password when only it is missing", async () => {
    renderRoutes("/login");
    await fillAndSubmit(admin.email, "");
    expect(screen.getByLabelText("Password")).toHaveFocus();
  });

  it("signs an admin in, records the login and opens Home (AUTH-07, AUD-03)", async () => {
    const { router, service } = renderRoutes("/login");
    await fillAndSubmit(admin.email, MOCK_PASSWORD);
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin");
    expect(service.logins).toEqual([{ accountId: admin.id, method: "password" }]);
  });

  it("shows Signing in… while waiting", async () => {
    const service = new MockAuthService();
    renderRoutes("/login", { service });
    await screen.findByLabelText("Email");
    const release = service.holdNextCall();
    await fillAndSubmit(admin.email, MOCK_PASSWORD);
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    release();
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
  });

  it.each([
    [admin.email, "wrong-password"],
    ["nobody@tallyup.test", MOCK_PASSWORD],
  ])("gives the same answer for a wrong password or unknown email (%s)", async (email, password) => {
    renderRoutes("/login");
    await fillAndSubmit(email, password);
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong email or password.");
  });

  it("AUTH-09: refuses an inactive account", async () => {
    renderRoutes("/login");
    await fillAndSubmit(inactiveAdmin.email, MOCK_PASSWORD);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your account is inactive. Contact your administrator.",
    );
  });

  it("AUTH-04: refuses a login with no Tally-Up account", async () => {
    renderRoutes("/login");
    await fillAndSubmit("orphan@tallyup.test", MOCK_PASSWORD);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No Tally-Up account exists for this email. Contact your administrator.",
    );
  });

  it("says when Tally-Up cannot be reached", async () => {
    const service = new MockAuthService();
    renderRoutes("/login", { service });
    await screen.findByLabelText("Email");
    service.failNextCallWith("unavailable");
    await fillAndSubmit(admin.email, MOCK_PASSWORD);
    expect(await screen.findByRole("alert")).toHaveTextContent("Tally-Up could not be reached.");
  });

  it("explains an inactive account found at start-up (AUTH-09)", async () => {
    renderRoutes("/login", { signedInAs: inactiveAdmin.id });
    expect(await screen.findByRole("alert")).toHaveTextContent("Your account is inactive.");
  });

  it("shows the start-up check failure above the form", async () => {
    const service = new MockAuthService();
    service.failNextCallWith("unavailable");
    renderRoutes("/login", { service });
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not check your sign-in.");
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("NFR-06: blocks sign-in while offline and says why", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderRoutes("/login");
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveAccessibleDescription("No connection.");
  });

  it("sends an already signed-in admin straight to Home", async () => {
    const { router } = renderRoutes("/login", { signedInAs: admin.id });
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin");
  });
});
