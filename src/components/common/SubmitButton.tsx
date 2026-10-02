/**
 * The button that submits a form: Submit Collection, Submit Distribution, Confirm Receipt.
 *
 * WHY:  A double tap must never create two records (COL-09, REQUIREMENTS §10).
 *       Users must see that saving is in progress within 100 ms (D-1, N1).
 * HOW:  While `pending`, the button is disabled, says "Saving…" (or a custom
 *       label), shows a spinner, and sets aria-busy. When disabled for another
 *       reason (e.g. offline), the reason is shown and linked to the button.
 * WHEN: At the bottom of every form that writes data (Milestones 2–7).
 * SECURITY: Disabling the button prevents accidental duplicates in the UI only.
 *       The database functions also refuse duplicates (e.g. a receipt can be
 *       confirmed once), so a replayed request cannot double-save (SEC-1).
 */
import { LoaderCircle } from "lucide-react";
import { useId, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { en } from "@/i18n/en";

export interface SubmitButtonProps {
  /** True while the save request is in flight. */
  pending: boolean;
  children: ReactNode;
  /** Text shown while pending; defaults to "Saving…". */
  pendingLabel?: string;
  /** Disable for a reason other than pending (invalid form, offline). */
  disabled?: boolean;
  /** Visible explanation when disabled, e.g. "No connection." */
  disabledReason?: string;
}

export function SubmitButton({
  pending,
  children,
  pendingLabel,
  disabled,
  disabledReason,
}: Readonly<SubmitButtonProps>) {
  const reasonId = useId();
  const showReason = Boolean(disabled && disabledReason && !pending);

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="submit"
        size="block"
        disabled={pending || disabled}
        aria-busy={pending ? "true" : "false"}
        aria-describedby={showReason ? reasonId : undefined}
      >
        {pending ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
            {pendingLabel ?? en.actions.saving}
          </>
        ) : (
          children
        )}
      </Button>
      {showReason ? (
        <p id={reasonId} className="text-center text-sm text-ink-muted">
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}
