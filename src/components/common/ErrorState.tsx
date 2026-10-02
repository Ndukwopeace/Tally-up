/**
 * Message shown when data could not be loaded.
 *
 * WHY:  N9: say what happened and what to do, in plain words, never "Error 422".
 *       Every data screen needs an error state (NFR-07, UI_GUIDELINES §10).
 * HOW:  An alert region (announced at once by screen readers, WCAG 4.1.3) with a
 *       "Try again" button that calls the caller's retry function.
 * WHEN: When a query fails (from Milestone 2, via TanStack Query's refetch).
 * SECURITY: Shows only messages from i18n/en.ts or the caller. Raw server error
 *       text is never shown, because it can reveal internal details.
 */
import { CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { en } from "@/i18n/en";

export interface ErrorStateProps {
  /** Plain-language explanation; defaults to a general connection message. */
  message?: string;
  /** Called when the user taps "Try again". */
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-card border border-danger/40 bg-danger-soft px-6 py-10 text-center"
    >
      <CircleAlert aria-hidden="true" className="size-10 text-danger" />
      <h2 className="text-xl font-semibold text-ink">{en.states.errorTitle}</h2>
      <p className="max-w-prose text-base text-ink">{message ?? en.states.errorDefault}</p>
      <Button variant="secondary" onClick={onRetry}>
        {en.actions.tryAgain}
      </Button>
    </div>
  );
}
