/**
 * A checkbox with its label and optional hint, as one large target.
 *
 * WHY:  Yes/no settings (Sold in Packs, Active) need a visible label (WCAG
 *       3.3.2) and a tap target of at least 48px (F-1); the whole row is
 *       clickable so small boxes are never a problem on a phone.
 * HOW:  A native <input type="checkbox"> inside its <label>; the hint is tied
 *       with aria-describedby.
 * WHEN: Forms in the admin screens.
 * SECURITY: Display only.
 */
import { useId } from "react";

export interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  hint?: string;
  disabled?: boolean;
}

export function CheckboxField({
  label,
  checked,
  onCheckedChange,
  hint,
  disabled,
}: Readonly<CheckboxFieldProps>) {
  const hintId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label className="flex min-h-12 cursor-pointer items-center gap-3 text-base font-semibold text-ink has-disabled:cursor-not-allowed has-disabled:opacity-60">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => {
            onCheckedChange(event.target.checked);
          }}
          aria-describedby={hint ? hintId : undefined}
          className="size-6 shrink-0 accent-brand"
        />
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
