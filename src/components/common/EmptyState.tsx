/**
 * Message shown when a list has nothing to show yet.
 *
 * WHY:  No blank screens (spec §49, NFR-07). An empty state says what is
 *       missing and, where possible, what to do next (C-5).
 * HOW:  Icon, heading, optional description, optional action (e.g. a button).
 * WHEN: Any list or page with no data, and as the placeholder for screens
 *       built in later milestones.
 * SECURITY: Display only.
 */
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  /** Short message, using the spec's wording where it exists. */
  title: string;
  description?: string;
  /** Next step, e.g. a "New Collection" button. */
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: Readonly<EmptyStateProps>) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-6 py-10 text-center shadow-sm">
      <Inbox aria-hidden="true" className="size-10 text-ink-muted" />
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {description ? <p className="max-w-prose text-base text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
