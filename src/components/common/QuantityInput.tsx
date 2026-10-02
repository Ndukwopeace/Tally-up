/**
 * Large numeric field for entering a quantity in a given unit.
 *
 * WHY:  Quantities are the core data of Tally-Up and are typed on phones with
 *       one hand, often outdoors (UI_GUIDELINES §0). The field must be big (F-4),
 *       open the number keypad (J-2, MB-4), show its unit (C-3), accept "1,500"
 *       (P-1) and refuse anything that is not a whole number (Q-20, P-3).
 * HOW:  Keeps the raw text the user typed, runs parseQuantity on every change,
 *       and reports a number (or null) to the parent. Problems are shown as text
 *       under the field and linked with aria-describedby (WCAG 3.3.1).
 * WHEN: New Collection, Distribute to Depot, and Depot count screens (Milestones 4–5).
 * SECURITY: Never trusted alone. Over-distribution and all other limits are
 *       re-checked by the database functions (DIS-06, SEC-1, SEC-5).
 */
import { useState } from "react";

import { parseQuantity } from "@/domain/quantity";
import { en } from "@/i18n/en";
import { cn } from "@/lib/cn";

export interface QuantityInputProps {
  /** Unique id; also used to build the ids of the hint and error text. */
  id: string;
  /** Visible label, usually the product name. */
  label: string;
  /** Unit shown inside the field, e.g. "Loaves". */
  unit: string;
  /** Current whole-number value, or null when nothing valid is entered. */
  value: number | null;
  /** Called on every change with the parsed number, or null if empty/invalid. */
  onValueChange: (value: number | null) => void;
  /** Error from the caller, e.g. "Only 4 Packs (43 Loaves) are available for distribution." */
  error?: string;
  /** Helper text under the field (N10). */
  hint?: string;
  disabled?: boolean;
}

export function QuantityInput({
  id,
  label,
  unit,
  value,
  onValueChange,
  error,
  hint,
  disabled,
}: Readonly<QuantityInputProps>) {
  // Raw text is kept so "1,500" stays as typed instead of jumping to "1500" mid-entry.
  const [text, setText] = useState(value === null ? "" : String(value));
  // Message for text that could not be read; null when the text is valid or empty.
  const [parseError, setParseError] = useState<string | null>(null);

  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // The field's own reading problem comes first; otherwise show the caller's rule error.
  const shownError = parseError ?? error;

  // Re-reads the text on every keystroke and tells the parent the result immediately (D-3).
  function handleChange(nextText: string) {
    setText(nextText);
    const result = parseQuantity(nextText);
    if (result.ok) {
      setParseError(null);
      onValueChange(result.value);
      return;
    }
    // An empty field is not an error while typing; required-field checks belong to the form.
    setParseError(result.reason === "empty" ? null : en.quantity[result.reason]);
    onValueChange(null);
  }

  const describedBy = [hint ? hintId : null, shownError ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-semibold text-ink">
        {label}
        {/* Spoken with the label so screen-reader users hear the unit too (WCAG 1.3.1). */}
        <span className="sr-only">, in {unit}</span>
      </label>
      <div
        className={cn(
          "flex min-h-14 items-center rounded-control border-2 bg-surface focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-brand",
          shownError ? "border-danger" : "border-line-strong",
          disabled && "opacity-60",
        )}
      >
        <input
          id={id}
          type="text"
          // J-2 / MB-4: standard numeric keypad on phones. type="text" (not "number") keeps
          // separators like "1,500" and avoids browsers silently changing the value on scroll.
          inputMode="numeric"
          autoComplete="off"
          value={text}
          onChange={(event) => {
            handleChange(event.target.value);
          }}
          disabled={disabled}
          aria-invalid={shownError ? "true" : "false"}
          aria-describedby={describedBy || undefined}
          className="min-w-0 flex-1 bg-transparent px-4 text-2xl font-semibold tabular-nums text-ink outline-none"
        />
        <span aria-hidden="true" className="px-4 text-base font-medium text-ink-muted">
          {unit}
        </span>
      </div>
      {hint ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {shownError ? (
        <p id={errorId} role="alert" className="text-sm font-semibold text-danger">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}
