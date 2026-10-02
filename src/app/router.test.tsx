/**
 * Tests for the routes and the three portal frames (Milestone 1).
 *
 * Rules under test:
 *  - ARCHITECTURE §4: portal routes under /admin, /distributor, /depot.
 *  - REQUIREMENTS §7: bottom tabs per role; admin navigation pending NAV-1.
 *  - J-1: notifications bell top-right. WCAG 2.4.1: skip link. WCAG 2.4.2: page titles.
 *  - Placeholder screens say which milestone builds them (no blank screens, §49).
 */
import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { routes } from "./router";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe("temporary start page (Milestone 1 only)", () => {
  it("links to the three portals", async () => {
    renderAt("/");
    expect(await screen.findByRole("heading", { level: 1, name: "Tally-Up preview" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the Admin portal" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: "Open the Distributor portal" })).toHaveAttribute(
      "href",
      "/distributor",
    );
    expect(screen.getByRole("link", { name: "Open the Depot Manager portal" })).toHaveAttribute(
      "href",
      "/depot",
    );
  });
});

describe("Distributor portal", () => {
  it("shows the dashboard placeholder with five bottom tabs, Dashboard active", async () => {
    renderAt("/distributor");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Distributor Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByText("This screen is built in Milestone 4.")).toBeInTheDocument();

    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Dashboard",
      "Collections",
      "Distributions",
      "History",
      "Profile",
    ]);
    expect(within(nav).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });

  it("highlights only the tab of the current page", async () => {
    renderAt("/distributor/collections");
    expect(await screen.findByRole("heading", { level: 1, name: "Collections" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getByRole("link", { name: "Collections" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it.each([
    ["/distributor/distributions", "Distributions", 4],
    ["/distributor/history", "History", 4],
    ["/distributor/profile", "Profile", 2],
    ["/distributor/notifications", "Notifications", 6],
  ])("%s shows the %s placeholder (Milestone %d)", async (path, title, milestone) => {
    renderAt(path);
    expect(await screen.findByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText(`This screen is built in Milestone ${milestone}.`)).toBeInTheDocument();
  });

  it("has a notifications bell linking to the distributor's notifications (J-1)", async () => {
    renderAt("/distributor");
    expect(await screen.findByRole("link", { name: "Notifications" })).toHaveAttribute(
      "href",
      "/distributor/notifications",
    );
  });

  it("offers a skip link to the main content (WCAG 2.4.1)", async () => {
    renderAt("/distributor");
    const skip = await screen.findByRole("link", { name: "Skip to main content" });
    expect(skip).toHaveAttribute("href", "#main");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
  });

  it("names the browser tab after the page (WCAG 2.4.2)", async () => {
    renderAt("/distributor/history");
    await screen.findByRole("heading", { level: 1, name: "History" });
    expect(document.title).toBe("History · Tally-Up");
  });
});

describe("Depot Manager portal", () => {
  it("shows four bottom tabs with Receipts active on the receipts page", async () => {
    renderAt("/depot/receipts");
    expect(await screen.findByRole("heading", { level: 1, name: "Receipts" })).toBeInTheDocument();
    expect(screen.getByText("This screen is built in Milestone 5.")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Dashboard", "Receipts", "History", "Profile"]);
    expect(within(nav).getByRole("link", { name: "Receipts" })).toHaveAttribute("aria-current", "page");
  });

  it.each([
    ["/depot", "Depot Dashboard", 5],
    ["/depot/history", "History", 5],
    ["/depot/profile", "Profile", 2],
    ["/depot/notifications", "Notifications", 6],
  ])("%s shows the %s placeholder (Milestone %d)", async (path, title, milestone) => {
    renderAt(path);
    expect(await screen.findByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText(`This screen is built in Milestone ${milestone}.`)).toBeInTheDocument();
  });
});

describe("Admin portal", () => {
  it("shows the dashboard placeholder and says navigation waits for NAV-1", async () => {
    renderAt("/admin");
    expect(await screen.findByRole("heading", { level: 1, name: "Admin Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("This screen is built in Milestone 6.")).toBeInTheDocument();
    expect(screen.getByText("Admin navigation is decided before Milestone 3 (NAV-1).")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute(
      "href",
      "/admin/notifications",
    );
  });

  it("has no bottom tabs yet, because their contents are not decided (NAV-1)", async () => {
    renderAt("/admin");
    await screen.findByRole("heading", { level: 1, name: "Admin Dashboard" });
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).not.toBeInTheDocument();
  });
});

describe("unknown addresses", () => {
  it("shows Page not found with a way back", async () => {
    renderAt("/distributor/does-not-exist");
    expect(await screen.findByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the start page" })).toHaveAttribute("href", "/");
  });
});
