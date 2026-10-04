/**
 * The "Corrected" marker next to a value an admin changed (COR-04).
 *
 * WHY:  Original records are never overwritten (COR-02). Where a corrected value is
 *       shown, it says so, and what the value was before.
 * HOW:  A pencil icon and text such as "Corrected, was 10 Caisses".
 * WHEN: Lines and counts on the collection and receipt detail pages.
 * SECURITY: Display only.
 */
import { Pencil } from "lucide-react";

import { en } from "@/i18n/en";

export function CorrectedMark({ was }: Readonly<{ was?: string }>) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink-muted">
      <Pencil aria-hidden="true" className="size-3.5 shrink-0" />
      {was === undefined ? en.ops.corrected : en.ops.correctedWas(was)}
    </span>
  );
}
