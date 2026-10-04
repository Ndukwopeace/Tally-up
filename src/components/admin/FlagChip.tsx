/**
 * A small warning flag with text, for items that have waited too long (COL-11, RCP-15, ADM-06).
 *
 * WHY:  A collection still In Progress, or a receipt still Awaiting Confirmation,
 *       for more than 24 hours must stand out to the admin without being a status
 *       of its own (statuses are computed by the database).
 * HOW:  An icon plus text in the warning colour, never colour alone (WCAG 1.4.1).
 * WHEN: Collection and receipt cards and detail pages.
 * SECURITY: Display only.
 */
import { Flag } from "lucide-react";

export function FlagChip({ children }: Readonly<{ children: string }>) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-warning">
      <Flag aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </span>
  );
}
