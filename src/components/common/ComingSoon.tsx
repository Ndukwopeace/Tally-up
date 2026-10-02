/**
 * Card for a screen that is not built yet.
 *
 * WHY:  UI review #7/#8: placeholder screens must use plain words (no milestone
 *       numbers or codes) and must not look like a real "no data" state, which
 *       later means "nothing recorded today" (EmptyState).
 * HOW:  Left-aligned row: construction icon, "Coming soon", one line of text.
 * WHEN: Every screen not built yet; replaced screen by screen as features land.
 * SECURITY: Display only.
 */
import { Construction } from "lucide-react";

import { en } from "@/i18n/en";

export function ComingSoon() {
  return (
    <div className="flex items-start gap-4 rounded-card border border-line bg-surface p-5 shadow-sm">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-canvas text-ink-muted">
        <Construction aria-hidden="true" className="size-6" />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-ink">{en.placeholder.title}</h2>
        <p className="text-base text-ink-muted">{en.placeholder.body}</p>
      </div>
    </div>
  );
}
