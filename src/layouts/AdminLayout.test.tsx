/**
 * Tests the admin frame once NAV-1 fills in its navigation lists.
 *
 * WHY: The lists are empty today, so the sidebar and phone tabs would otherwise
 *      be untested code. This test supplies stand-in items to prove both render.
 */
import { render, screen, within } from "@testing-library/react";
import { LayoutDashboard } from "lucide-react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import AdminLayout from "./AdminLayout";

vi.mock("@/app/navigation", () => ({
  ADMIN_SIDEBAR_NAV: [{ label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true }],
  ADMIN_MOBILE_NAV: [{ label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true }],
}));

describe("AdminLayout with navigation items", () => {
  it("shows the sidebar and phone tabs, with the current page marked", async () => {
    const router = createMemoryRouter(
      [{ path: "/admin", element: <AdminLayout />, children: [{ index: true, element: <h1>Home</h1> }] }],
      { initialEntries: ["/admin"] },
    );
    render(<RouterProvider router={router} />);
    await screen.findByRole("heading", { name: "Home" });

    const navs = screen.getAllByRole("navigation", { name: "Main navigation" });
    // One in the desktop sidebar, one as phone bottom tabs.
    expect(navs).toHaveLength(2);
    for (const nav of navs) {
      expect(within(nav).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    }
    expect(screen.queryByText(/NAV-1/)).not.toBeInTheDocument();
  });
});
