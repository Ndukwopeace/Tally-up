/**
 * Tests for the routes, portal frames and navigation behaviour.
 *
 * Rules under test:
 *  - Q-47: admin phone tabs, More page, bell + account menu at the top.
 *  - Q-46: distributor tabs without History.
 *  - Q-50: tabs do not add browser history; pages below the top level show Back;
 *          the logo goes to the portal's home.
 *  - WCAG 1.4.1: the active tab is not shown by colour alone.
 *  - WCAG 2.4.1 skip link, 2.4.2 page titles; no developer wording on screen.
 * Each portal is rendered signed in as its own role (guards are tested in
 * src/auth/RequireRole.test.tsx).
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ownerOf, renderRoutes } from "../../tests/helpers/renderRoutes";

// Renders `path` signed in as the user whose portal it is (admin for anything else).
function renderAt(path: string, history: string[] = []) {
  return renderRoutes(path, { history, signedInAs: ownerOf(path) }).router;
}

const mainNav = () => screen.getByRole("navigation", { name: "Main navigation" });

describe("Admin portal (Q-47)", () => {
  it("opens on Home with today's date and four bottom tabs, Home active", async () => {
    renderAt("/admin");
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(screen.getByTestId("today")).toHaveTextContent(/\d{4}/);
    const links = within(mainNav()).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Home", "Collections", "Distributions", "More"]);
    expect(within(mainNav()).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  });

  it("shows the active tab with a visible marker, not colour alone (WCAG 1.4.1)", async () => {
    renderAt("/admin/collections");
    await screen.findByRole("heading", { level: 1, name: "Collections" });
    const active = within(mainNav()).getByRole("link", { name: "Collections" });
    expect(active.querySelector("[data-active-marker]")).not.toBeNull();
    const inactive = within(mainNav()).getByRole("link", { name: "Home" });
    expect(inactive.querySelector("[data-active-marker]")).toBeNull();
  });

  it("lists Depots, Products, Users and Reports on the More page", async () => {
    renderAt("/admin/more");
    expect(await screen.findByRole("heading", { level: 1, name: "More" })).toBeInTheDocument();
    for (const [name, href] of [
      ["Depots", "/admin/depots"],
      ["Products", "/admin/products"],
      ["Users", "/admin/users"],
      ["Reports", "/admin/reports"],
      ["Audit log", "/admin/audit"],
      ["Settings", "/admin/settings"],
    ]) {
      expect(screen.getByRole("link", { name: new RegExp(`^${name}`) })).toHaveAttribute("href", href);
    }
  });

  it.each([
    ["Depots", "/admin/depots"],
    ["Products", "/admin/products"],
    ["Users", "/admin/users"],
    ["Reports", "/admin/reports"],
    ["Audit log", "/admin/audit"],
    ["Settings", "/admin/settings"],
  ])("%s keeps the More tab active and shows Back", async (name, path) => {
    renderAt(path);
    expect(await screen.findByRole("heading", { level: 1, name })).toBeInTheDocument();
    expect(within(mainNav()).getByRole("link", { name: "More" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("Back returns to the previous page when there is one", async () => {
    const router = renderAt("/admin/depots", ["/admin/more"]);
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/admin/more");
  });

  it("Back goes up to the parent page when the page was opened directly", async () => {
    const router = renderAt("/admin/depots");
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/admin/more");
  });

  it("switching tabs does not add browser history, so a back-swipe does not walk through tabs (Q-50)", async () => {
    const router = renderAt("/admin");
    await userEvent.click(
      await within(await screen.findByRole("navigation", { name: "Main navigation" })).findByRole("link", {
        name: "Collections",
      }),
    );
    expect(router.state.location.pathname).toBe("/admin/collections");
    expect(router.state.historyAction).toBe("REPLACE");
  });

  it.each([
    ["/admin/collections", "Collections"],
    ["/admin/distributions", "Distributions"],
    ["/admin/more", "More"],
  ])("tab screen %s has Back, which goes to Home (not to the previously tapped tab)", async (path, title) => {
    const router = renderAt(path, ["/admin", "/admin/distributions"]);
    expect(await screen.findByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/admin");
  });

  it("Home has Back, which asks 'Sign out?' (Q-53: nothing earlier to go back to)", async () => {
    const router = renderAt("/admin");
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/admin/sign-out");
    expect(await screen.findByRole("heading", { level: 1, name: "Sign out?" })).toBeInTheDocument();
  });

  it("the logo takes you to Home", async () => {
    renderAt("/admin/collections");
    expect(await screen.findByRole("link", { name: "Tally-Up, go to Home" })).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("has the bell and an account menu with Profile / My Account and Sign Out", async () => {
    const router = renderAt("/admin");
    expect(await screen.findByRole("link", { name: "Notifications" })).toHaveAttribute(
      "href",
      "/admin/notifications",
    );
    const account = screen.getByRole("button", { name: "Account" });
    expect(account).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(account);
    expect(account).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Profile / My Account" })).toHaveAttribute(
      "href",
      "/admin/profile",
    );
    await userEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(router.state.location.pathname).toBe("/admin/sign-out");
  });

  it("closes the account menu with Escape and returns focus to the button", async () => {
    renderAt("/admin");
    const account = await screen.findByRole("button", { name: "Account" });
    await userEvent.click(account);
    await userEvent.keyboard("{Escape}");
    expect(account).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Profile / My Account" })).not.toBeInTheDocument();
    expect(account).toHaveFocus();
  });

  it("closes the account menu when tapping outside it", async () => {
    renderAt("/admin");
    const account = await screen.findByRole("button", { name: "Account" });
    await userEvent.click(account);
    await userEvent.click(screen.getByRole("heading", { level: 1, name: "Home" }));
    expect(account).toHaveAttribute("aria-expanded", "false");
  });

  it.each([
    ["/admin/profile", "Profile / My Account"],
    ["/admin/notifications", "Notifications"],
  ])("%s opens from the header and offers Back", async (path, title) => {
    renderAt(path);
    expect(await screen.findByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("shows plain 'Coming soon' wording, not developer notes, on unbuilt screens", async () => {
    renderAt("/admin/collections");
    await screen.findByRole("heading", { level: 1, name: "Collections" });
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.queryByText(/Milestone|NAV-1/)).not.toBeInTheDocument();
  });
});

describe("Distributor portal (Q-46)", () => {
  it("shows Dashboard with four tabs and no History tab", async () => {
    renderAt("/distributor");
    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(
      within(mainNav())
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Dashboard", "Collections", "Distributions", "Profile"]);
  });

  it("no longer has a separate History page", async () => {
    renderAt("/distributor/history");
    expect(await screen.findByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
  });

  it("opens notifications from the bell, with Back", async () => {
    renderAt("/distributor/notifications");
    expect(await screen.findByRole("heading", { level: 1, name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });
});

describe("Depot Manager portal", () => {
  it("shows four tabs with Receipts active on the receipts page", async () => {
    renderAt("/depot/receipts");
    expect(await screen.findByRole("heading", { level: 1, name: "Receipts" })).toBeInTheDocument();
    expect(
      within(mainNav())
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Dashboard", "Receipts", "History", "Profile"]);
    expect(within(mainNav()).getByRole("link", { name: "Receipts" })).toHaveAttribute("aria-current", "page");
  });

  it.each([
    ["/depot", "Dashboard"],
    ["/depot/history", "History"],
    ["/depot/profile", "Profile"],
  ])("%s shows the %s screen", async (path, title) => {
    renderAt(path);
    expect(await screen.findByRole("heading", { level: 1, name: title })).toBeInTheDocument();
  });
});

describe("every portal", () => {
  it("offers a skip link to the main content (WCAG 2.4.1)", async () => {
    renderAt("/depot");
    expect(await screen.findByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main",
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
  });

  it("names the browser tab after the page (WCAG 2.4.2)", async () => {
    renderAt("/admin/reports");
    await screen.findByRole("heading", { level: 1, name: "Reports" });
    expect(document.title).toBe("Reports · Tally-Up");
  });
});

describe("unknown addresses", () => {
  it("has a Back arrow, like every other screen; opened directly it leads to the user's portal", async () => {
    const router = renderAt("/nowhere");
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    // "/" sends a signed-in admin on to their portal (AUTH-07).
    expect(router.state.location.pathname).toBe("/admin");
  });

  it("shows Page not found with the logo and a way back", async () => {
    renderAt("/nowhere");
    expect(await screen.findByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText("Tally-")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the start page" })).toHaveAttribute("href", "/");
  });
});

describe("Back on every portal screen", () => {
  it.each([
    "/distributor",
    "/distributor/collections",
    "/distributor/distributions",
    "/distributor/profile",
    "/depot",
    "/depot/receipts",
    "/depot/history",
    "/depot/profile",
  ])("%s shows a Back arrow", async (path) => {
    renderAt(path);
    expect(await screen.findByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("a distributor tab goes back to the Dashboard", async () => {
    const router = renderAt("/distributor/profile");
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/distributor");
  });
});
