/**
 * Tests for AppLogo (owner decision Q-45: use the wireframe truck logo).
 *
 *  - The wordmark reads "Tally-Up" as one name for screen readers.
 *  - "Tally-" and "Up" are styled separately (blue/white + orange), as in the wireframes.
 *  - The truck drawing is decorative and built from the shared shape list.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppLogo } from "./AppLogo";

import logo from "@/assets/logo-shapes.json";

describe("AppLogo", () => {
  it("reads as the single name 'Tally-Up'", () => {
    const { container } = render(<AppLogo />);
    expect(container).toHaveTextContent("Tally-Up");
    expect(screen.getByText("Up")).toBeInTheDocument();
  });

  it("colours 'Tally-' blue and 'Up' orange on light backgrounds", () => {
    render(<AppLogo />);
    expect(screen.getByText("Tally-")).toHaveClass("text-brand");
    expect(screen.getByText("Up")).toHaveClass("text-accent");
  });

  it("colours 'Tally-' white on the dark admin sidebar, 'Up' stays orange", () => {
    render(<AppLogo tone="onDark" />);
    expect(screen.getByText("Tally-")).toHaveClass("text-white");
    expect(screen.getByText("Up")).toHaveClass("text-accent");
  });

  it("draws the truck from the shared shape list, hidden from screen readers", () => {
    const { container } = render(<AppLogo />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("viewBox", logo.viewBox);
    expect(svg?.children).toHaveLength(logo.shapes.length);
  });
});
