/**
 * The Tally-Up mark (five tally strokes) and wordmark.
 *
 * WHY:  One logo used in every header and the sidebar, matching the app icon
 *       in public/ so the installed app and the screen look the same.
 * HOW:  Inline SVG (no network request) plus the app name as real text.
 *       `tone` switches the colours for the dark admin sidebar.
 * WHEN: Portal headers, admin sidebar, start page.
 * SECURITY: Static markup only.
 */
import { en } from "@/i18n/en";
import { cn } from "@/lib/cn";

export function AppLogo({ tone = "onLight" }: { tone?: "onLight" | "onDark" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-xl font-bold",
        tone === "onLight" ? "text-ink" : "text-white",
      )}
    >
      {/* Decorative: the name next to it is the accessible text. */}
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8 shrink-0">
        <rect width="32" height="32" rx="8" className="fill-brand" />
        <g stroke="white" strokeWidth="2.6" strokeLinecap="round">
          <path d="M9 9v14M13.5 9v14M18 9v14M22.5 9v14M6.5 21.5 25 10.5" />
        </g>
      </svg>
      {en.app.name}
    </span>
  );
}
