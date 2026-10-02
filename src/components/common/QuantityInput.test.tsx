/**
 * Tests for QuantityInput: the large number field used for every quantity.
 *
 * Rules under test:
 *  - MB-4 / J-2: numeric keypad on phones, unit shown with the number.
 *  - F-4: large field.
 *  - 3.3.1 / 3.3.2 (WCAG): visible label, errors in text linked to the field.
 *  - P-1 / Q-20: liberal input, strict whole-number output.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { QuantityInput } from "./QuantityInput";

function Harness({ onValue }: { onValue: (value: number | null) => void }) {
  const [value, setValue] = useState<number | null>(null);
  return (
    <QuantityInput
      id="qty"
      label="Big Bread"
      unit="Loaves"
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValue(next);
      }}
    />
  );
}

describe("QuantityInput", () => {
  it("has a visible label, includes the unit in the spoken name, and opens the numeric keypad", () => {
    render(<Harness onValue={vi.fn()} />);
    const input = screen.getByLabelText("Big Bread, in Loaves");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "off");
  });

  it("shows the unit next to the number (C-3: numbers always carry their unit)", () => {
    render(<Harness onValue={vi.fn()} />);
    expect(screen.getByText("Loaves")).toBeInTheDocument();
  });

  it("reports the whole number as it is typed, accepting thousands separators", async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await userEvent.type(screen.getByLabelText("Big Bread, in Loaves"), "1,500");
    expect(onValue).toHaveBeenLastCalledWith(1500);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports null and explains the problem for a decimal", async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByLabelText("Big Bread, in Loaves");
    await userEvent.type(input, "1.5");
    expect(onValue).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("alert")).toHaveTextContent("Use whole numbers only, like 200 or 1,500.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Use whole numbers only, like 200 or 1,500.");
  });

  it("explains a negative number", async () => {
    render(<Harness onValue={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Big Bread, in Loaves"), "-3");
    expect(screen.getByRole("alert")).toHaveTextContent("Quantities cannot be negative.");
  });

  it("treats a cleared field as no value, without an error", async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByLabelText("Big Bread, in Loaves");
    await userEvent.type(input, "5");
    await userEvent.clear(input);
    expect(onValue).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("shows an error supplied by the caller (e.g. over-distribution) and links it to the field", () => {
    render(
      <QuantityInput
        id="qty"
        label="Big Bread"
        unit="Packs"
        value={70}
        onValueChange={vi.fn()}
        error="Only 4 Packs (43 Loaves) are available for distribution."
      />,
    );
    const input = screen.getByLabelText("Big Bread, in Packs");
    expect(input).toHaveValue("70");
    expect(input).toHaveAccessibleDescription("Only 4 Packs (43 Loaves) are available for distribution.");
  });

  it("shows a helper hint under the field when given", () => {
    render(
      <QuantityInput
        id="qty"
        label="Big Bread"
        unit="Loaves"
        value={null}
        onValueChange={vi.fn()}
        hint="Count what you physically received."
      />,
    );
    expect(screen.getByLabelText("Big Bread, in Loaves")).toHaveAccessibleDescription(
      "Count what you physically received.",
    );
  });

  it("can be disabled", () => {
    render(
      <QuantityInput
        id="qty"
        label="Big Bread"
        unit="Loaves"
        value={null}
        onValueChange={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByLabelText("Big Bread, in Loaves")).toBeDisabled();
  });
});
