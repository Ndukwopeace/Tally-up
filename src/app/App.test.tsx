/**
 * Smoke test for the real app root: providers + browser router render the start page.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("renders the start page at /", async () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: "Tally-Up preview" })).toBeInTheDocument();
  });
});
