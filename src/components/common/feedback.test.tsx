/**
 * Tests for the feedback components every data screen needs (NFR-07, UI_GUIDELINES §10):
 * SubmitButton, EmptyState, ErrorState, PageSkeleton, and the base Button.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { PageSkeleton } from "./PageSkeleton";
import { SubmitButton } from "./SubmitButton";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("is at least 48px tall by default (F-1)", () => {
    render(<Button>Next</Button>);
    expect(screen.getByRole("button", { name: "Next" })).toHaveClass("min-h-12");
  });

  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Next</Button>);
    expect(screen.getByRole("button", { name: "Next" })).toHaveAttribute("type", "button");
  });

  it.each(["primary", "secondary", "ghost", "danger"] as const)("renders the %s variant", (variant) => {
    render(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });
});

describe("SubmitButton", () => {
  it("submits and is enabled when idle", () => {
    render(<SubmitButton pending={false}>Submit Distribution</SubmitButton>);
    const button = screen.getByRole("button", { name: "Submit Distribution" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-busy", "false");
  });

  it("disables itself and says 'Saving…' while pending (COL-09: no double submit)", () => {
    render(<SubmitButton pending>Submit Distribution</SubmitButton>);
    const button = screen.getByRole("button", { name: "Saving…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("uses a custom pending label when given", () => {
    render(
      <SubmitButton pending pendingLabel="Confirming…">
        Confirm Receipt
      </SubmitButton>,
    );
    expect(screen.getByRole("button", { name: "Confirming…" })).toBeDisabled();
  });

  it("can be disabled with a visible reason (e.g. offline)", () => {
    render(
      <SubmitButton pending={false} disabled disabledReason="No connection.">
        Submit Collection
      </SubmitButton>,
    );
    const button = screen.getByRole("button", { name: "Submit Collection" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("No connection.");
  });
});

describe("EmptyState", () => {
  it("shows the message and an optional next action (C-5)", () => {
    render(
      <EmptyState
        title="No receipts awaiting confirmation."
        description="New receipts from distributors will appear here."
        action={<Button>Refresh</Button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "No receipts awaiting confirmation." })).toBeInTheDocument();
    expect(screen.getByText("New receipts from distributors will appear here.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("works with a title only", () => {
    render(<EmptyState title="No discrepancies found." />);
    expect(screen.getByRole("heading", { name: "No discrepancies found." })).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("announces the problem and offers Try again (N9)", async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("alert")).toHaveTextContent("We could not load this.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows a specific message when given", () => {
    render(<ErrorState message="Receipts could not be loaded." onRetry={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Receipts could not be loaded.");
  });
});

describe("PageSkeleton", () => {
  it("tells assistive technology the page is loading", () => {
    render(<PageSkeleton />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("draws the requested number of placeholder rows", () => {
    const { container } = render(<PageSkeleton rows={5} />);
    expect(container.querySelectorAll("[data-skeleton-row]")).toHaveLength(5);
  });
});
