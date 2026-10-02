/**
 * Tests for the navigation loading bar.
 *
 * Rule under test: Q-56, every action shows an indicator — a screen that is
 * still loading after a tap shows a bar (announced as "Loading…"); nothing is
 * shown once it has loaded.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Link, Outlet, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { NavigationProgress } from "./NavigationProgress";

describe("NavigationProgress", () => {
  it("shows a loading bar while the next screen loads, then hides it", async () => {
    let finishLoading: (value: null) => void = () => undefined;
    const router = createMemoryRouter([
      {
        element: (
          <>
            <NavigationProgress />
            <Outlet />
          </>
        ),
        children: [
          { path: "/", element: <Link to="/slow">Open</Link> },
          {
            path: "/slow",
            // A screen whose data is still on its way.
            loader: () =>
              new Promise<null>((resolve) => {
                finishLoading = resolve;
              }),
            element: <h1>Slow page</h1>,
          },
        ],
      },
    ]);
    render(<RouterProvider router={router} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Open" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Loading…");

    finishLoading(null);
    expect(await screen.findByRole("heading", { name: "Slow page" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
