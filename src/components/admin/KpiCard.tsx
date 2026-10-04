/**
 * One number on the admin Home (ADM-01), optionally a link into the list behind it.
 *
 * WHY:  The admin reads today's picture at a glance. A card has a label, the
 *       figure, and a short note saying what it counts ("today", "all open"), so a
 *       number is never read as something it is not (Q-59c).
 * HOW:  The label and note are text, the figure is large. With `to`, the whole
 *       card is a link. `tone="danger"` is used only for Discrepancies, the one
 *       thing that is allowed to be red on a dashboard (UI_GUIDELINES, Von Restorff).
 * WHEN: Home (A3b-2).
 * SECURITY: Display only.
 */
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

export function KpiCard({
  label,
  note,
  to,
  tone,
  children,
}: Readonly<{ label: string; note?: string; to?: string; tone?: "danger"; children: ReactNode }>) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink-muted">{label}</span>
        {to ? <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-muted" /> : null}
      </span>
      <span className={`text-2xl font-bold break-words ${tone === "danger" ? "text-danger" : "text-ink"}`}>
        {children}
      </span>
      {note ? <span className="text-sm text-ink-muted">{note}</span> : null}
    </>
  );
  const frame = "flex flex-col gap-1 rounded-card border border-line bg-surface px-4 py-3 shadow-sm";
  return to ? (
    <Link to={to} className={`${frame} hover:border-brand active:bg-canvas`}>
      {body}
    </Link>
  ) : (
    <div className={frame}>{body}</div>
  );
}
