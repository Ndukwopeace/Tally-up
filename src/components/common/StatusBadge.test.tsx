/**
 * Tests for StatusBadge.
 *
 * Rules under test:
 *  - NFR-11: one badge component, one colour per status.
 *  - WCAG 1.4.1 / UI_GUIDELINES §8: status is never colour alone — text + icon + colour.
 *  - Wireframe review W-A3: only the five defined labels exist.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { STATUS_TONE, StatusBadge } from "./StatusBadge";

import { COLLECTION_STATUSES, RECEIPT_STATUSES, type Status } from "@/types/enums";

const ALL: Status[] = [...COLLECTION_STATUSES, ...RECEIPT_STATUSES];

describe("StatusBadge", () => {
  it.each([
    ["in_progress", "In Progress"],
    ["fully_distributed", "Fully Distributed"],
    ["awaiting_confirmation", "Awaiting Confirmation"],
    ["confirmed", "Confirmed"],
    ["confirmed_with_discrepancy", "Confirmed with Discrepancy"],
  ] as const)("shows %s as the text %j", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each(ALL)("shows an icon next to the text for %s (not colour alone)", (status) => {
    const { container } = render(<StatusBadge status={status} />);
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    // Decorative: the text already says the status, so screen readers skip the icon.
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("maps each status to the tone in UI_GUIDELINES §8", () => {
    expect(STATUS_TONE).toEqual({
      in_progress: "warning",
      fully_distributed: "success",
      awaiting_confirmation: "warning",
      confirmed: "success",
      confirmed_with_discrepancy: "danger",
    });
  });

  it("uses red (danger) only for discrepancies (Von Restorff, UI_GUIDELINES §1.8)", () => {
    const danger = ALL.filter((status) => STATUS_TONE[status] === "danger");
    expect(danger).toEqual(["confirmed_with_discrepancy"]);
  });
});
