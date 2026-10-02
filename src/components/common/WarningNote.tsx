/**
 * A consequence the admin should read before saving.
 *
 * WHY:  Some saves change other people's accounts (a manager is deactivated or
 *       left without a depot, Q-57c, DEP-03). The form says so in words first (N5).
 * HOW:  A bordered note with an icon and text, never colour alone (WCAG 1.4.1).
 * WHEN: Depot form (A2b) and user form (A2c), inside a polite live region so a new
 *       warning is read out when it appears.
 * SECURITY: Display only.
 */
import { TriangleAlert } from "lucide-react";

export function WarningNote({ children }: Readonly<{ children: string }>) {
  return (
    <p className="flex items-start gap-3 rounded-card border border-warning/40 bg-warning-soft px-4 py-3 text-base text-ink">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
      {children}
    </p>
  );
}
