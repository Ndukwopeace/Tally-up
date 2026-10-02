/**
 * Labelled text input with hint and error: email, password and other plain fields.
 *
 * WHY:  Every form field needs a visible label (WCAG 3.3.2, 1.3.1), a large tap
 *       target (F-1) and an error tied to the field so screen readers read it
 *       (WCAG 3.3.1). One component keeps all forms consistent (N4).
 * HOW:  <label for> + <input>; the error (and optional hint) are linked with
 *       aria-describedby and the field is marked aria-invalid while in error.
 *       Same look as QuantityInput.
 * WHEN: Login, forgot password, new password, and later admin forms.
 * SECURITY: Display only. Values are validated by the form and again by the
 *       backend (SEC-5). `autoComplete` lets password managers fill the right
 *       field, which encourages strong, unique passwords.
 */
import type { HTMLAttributes, Ref } from "react";

import { cn } from "@/lib/cn";

export interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  hint?: string;
  error?: string;
  disabled?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function TextField({
  id,
  label,
  value,
  onValueChange,
  type = "text",
  autoComplete,
  inputMode,
  hint,
  error,
  disabled,
  ref,
}: Readonly<TextFieldProps>) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-semibold text-ink">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        type={type}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
        }}
        autoComplete={autoComplete}
        inputMode={inputMode}
        // Emails and passwords must be typed exactly; phones must not "correct" them.
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={describedBy || undefined}
        className={cn(
          "min-h-14 rounded-control border-2 bg-surface px-4 text-lg text-ink outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand",
          error ? "border-danger" : "border-line-strong",
          disabled && "opacity-60",
        )}
      />
      {hint ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
