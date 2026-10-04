/**
 * A collapsible box of list filters (UI_GUIDELINES H-5, Q-59g).
 *
 * WHY:  Admin lists can be filtered, but the filters should not push the list off a
 *       phone screen. They start collapsed, with a count of how many are on.
 * HOW:  A native <details> with a large summary (48px target); the fields go inside;
 *       "Clear filters" appears while any filter is on. It stays open while any is on.
 * WHEN: Collections and Distributions lists.
 * SECURITY: Display only; the filter values live in the page address (ARCHITECTURE §3.3).
 */
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { en } from "@/i18n/en";

export function FilterPanel({
  activeCount,
  onClear,
  children,
}: Readonly<{ activeCount: number; onClear: () => void; children: ReactNode }>) {
  return (
    <details open={activeCount > 0} className="rounded-card border border-line bg-surface">
      <summary className="flex min-h-12 cursor-pointer items-center px-4 text-base font-semibold text-ink">
        {activeCount > 0 ? en.ops.filters.titleOn(activeCount) : en.ops.filters.title}
      </summary>
      <div className="flex flex-col gap-4 border-t border-line px-4 py-4">
        {children}
        {activeCount > 0 ? (
          <Button variant="secondary" onClick={onClear}>
            {en.ops.filters.clear}
          </Button>
        ) : null}
      </div>
    </details>
  );
}
