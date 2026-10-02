/**
 * The admin "More" tab: Depots, Products, Users, Reports.
 *
 * WHY:  Q-47: four bottom tabs cannot hold every admin area, so the less
 *       frequent ones live here. Each row says what it holds (N6, recognition
 *       rather than recall).
 * HOW:  A list of large rows (icon, name, one-line description, chevron), each
 *       at least 64px tall (F-1). Opened pages show Back to return here.
 * WHEN: /admin/more.
 * SECURITY: Links only. RequireRole("admin") guards the page (AUTH-08); RLS guards the data.
 */
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { PageTitle } from "./PageTitle";

import { ADMIN_MORE_ITEMS } from "@/app/navigation";
import { en } from "@/i18n/en";

export function AdminMorePage() {
  return (
    <>
      <PageTitle title={en.nav.more} />
      <ul className="overflow-hidden rounded-card border border-line bg-surface shadow-sm">
        {ADMIN_MORE_ITEMS.map(({ label, to, icon: Icon, description }) => (
          <li key={to} className="border-b border-line last:border-b-0">
            <Link to={to} className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-canvas">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-ink">{label}</span>
                <span className="block text-sm text-ink-muted">{description}</span>
              </span>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
