/**
 * Labelled drop-down list (native <select>).
 *
 * WHY:  Choosing one of a few known items (a depot's manager, later a user's
 *       depot) is faster and safer from a list than by typing (N5, Hick's law
 *       kept small by listing only valid choices). The phone's own picker is
 *       large and accessible by default.
 * HOW:  <label for> + <select>, hint linked with aria-describedby; same look
 *       as TextField.
 * WHEN: Depot form (manager), user form (depot, role).
 * SECURITY: Display only; the database checks the chosen value again.
 */
import { useId } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  options: readonly SelectOption[];
  onValueChange: (value: string) => void;
  hint?: string;
  disabled?: boolean;
}

export function SelectField({
  id,
  label,
  value,
  options,
  onValueChange,
  hint,
  disabled,
}: Readonly<SelectFieldProps>) {
  const hintId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-semibold text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onValueChange(event.target.value);
        }}
        aria-describedby={hint ? hintId : undefined}
        className="min-h-14 rounded-control border-2 border-line-strong bg-surface px-4 text-lg text-ink outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
