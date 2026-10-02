/**
 * Page heading plus the browser-tab title.
 *
 * WHY:  Every page has one clear h1 (WCAG 2.4.6) and a matching browser-tab /
 *       app-switcher title (WCAG 2.4.2). One component keeps both in step.
 * HOW:  React 19 lifts <title> into the document head automatically.
 *       An optional line under the heading carries context such as today's date.
 * WHEN: Top of every page.
 * SECURITY: Display only.
 */
import type { ReactNode } from "react";

import { en } from "@/i18n/en";

export function PageTitle({ title, subtitle }: Readonly<{ title: string; subtitle?: ReactNode }>) {
  return (
    <div className="mb-6">
      <title>{`${title} · ${en.app.name}`}</title>
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      {subtitle ? <p className="mt-1 text-base text-ink-muted">{subtitle}</p> : null}
    </div>
  );
}
