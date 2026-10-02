/**
 * Grey placeholder blocks shown while a page's data loads.
 *
 * WHY:  D-2: something appears at once, shaped like the content, so the app
 *       feels responsive on slow phones. NFR-07 requires a loading state.
 * HOW:  A status region with hidden "Loading…" text for screen readers and a
 *       number of pulsing rows. Animation is disabled for users who ask for
 *       reduced motion (global rule in index.css).
 * WHEN: While a query is loading (from Milestone 2).
 * SECURITY: Display only.
 */
import { en } from "@/i18n/en";

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">{en.states.loading}</span>
      <div aria-hidden="true" className="h-8 w-1/2 animate-pulse rounded-control bg-line" />
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          data-skeleton-row
          aria-hidden="true"
          className="h-20 animate-pulse rounded-card bg-line"
        />
      ))}
    </div>
  );
}
