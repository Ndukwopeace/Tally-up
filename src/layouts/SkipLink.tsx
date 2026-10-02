/**
 * "Skip to main content" link, visible only when focused with a keyboard.
 *
 * WHY:  WCAG 2.4.1 (Bypass Blocks): keyboard and screen-reader users can jump
 *       past the header and navigation straight to the page content.
 * HOW:  Visually hidden until focused; points at <main id="main">.
 * WHEN: First element of every portal layout.
 * SECURITY: None.
 */
import { en } from "@/i18n/en";

export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-3 focus:font-semibold focus:text-brand"
    >
      {en.app.skipToContent}
    </a>
  );
}
