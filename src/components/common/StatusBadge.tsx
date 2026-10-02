/**
 * Shows a collection or receipt status as a coloured badge with an icon and text.
 *
 * WHY:  NFR-11 requires one badge component with one colour per status across
 *       all portals. WCAG 1.4.1 requires status to never rely on colour alone,
 *       so each badge has text + icon + colour (UI_GUIDELINES §8).
 * HOW:  Looks up the label (i18n), tone and icon for the status. Text colours
 *       are the 700 shades on 50-shade backgrounds, which pass 4.5:1 contrast (WCAG 1.4.3).
 * WHEN: Wherever a collection or receipt status appears (lists, details, dashboards).
 * SECURITY: Display only. Status is computed by the database (RCP-11, COL-08);
 *       this component never decides a status.
 */
import { CircleCheck, CircleDashed, Hourglass, TriangleAlert, type LucideIcon } from "lucide-react";

import { en } from "@/i18n/en";
import { cn } from "@/lib/cn";
import type { Status } from "@/types/enums";

export type StatusTone = "success" | "warning" | "danger";

// RULE UI_GUIDELINES §8: In Progress / Awaiting = amber, Fully Distributed / Confirmed = green,
// Discrepancy = red. Red is reserved for discrepancies (Von Restorff, §1.8).
export const STATUS_TONE: Readonly<Record<Status, StatusTone>> = {
  in_progress: "warning",
  fully_distributed: "success",
  awaiting_confirmation: "warning",
  confirmed: "success",
  confirmed_with_discrepancy: "danger",
};

// Each status has its own icon so two amber badges can still be told apart.
const STATUS_ICON: Readonly<Record<Status, LucideIcon>> = {
  in_progress: CircleDashed,
  fully_distributed: CircleCheck,
  awaiting_confirmation: Hourglass,
  confirmed: CircleCheck,
  confirmed_with_discrepancy: TriangleAlert,
};

const TONE_CLASSES: Readonly<Record<StatusTone, string>> = {
  success: "bg-success-soft text-success ring-success/30",
  warning: "bg-warning-soft text-warning ring-warning/30",
  danger: "bg-danger-soft text-danger ring-danger/30",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset",
        TONE_CLASSES[STATUS_TONE[status]],
        className,
      )}
    >
      {/* Decorative: the text beside it carries the meaning for screen readers. */}
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {en.status[status]}
    </span>
  );
}
