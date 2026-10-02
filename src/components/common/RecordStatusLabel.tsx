/**
 * "Active" / "Inactive" label for users, depots and products (REQUIREMENTS §8).
 *
 * WHY:  Lists must show at a glance which records are switched off (N1). The
 *       five-status StatusBadge is reserved for collections and receipts
 *       (NFR-11, W-A3), so master data gets its own small label.
 * HOW:  Icon + text + colour, never colour alone (WCAG 1.4.1).
 * WHEN: Product, depot and user lists.
 * SECURITY: Display only.
 */
import { CircleCheck, CircleMinus } from "lucide-react";

import { en } from "@/i18n/en";
import { cn } from "@/lib/cn";
import type { RecordStatus } from "@/types/enums";

export function RecordStatusLabel({ status }: Readonly<{ status: RecordStatus }>) {
  const Icon = status === "active" ? CircleCheck : CircleMinus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-semibold",
        status === "active" ? "text-success" : "text-ink-muted",
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {en.recordStatus[status]}
    </span>
  );
}
