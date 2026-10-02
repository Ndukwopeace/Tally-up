/**
 * Stand-in for a screen that a later milestone builds.
 *
 * WHY:  Milestone 1 delivers the portal frames only. Each route still shows its
 *       real title and says when it arrives, instead of a blank page (spec §49).
 * HOW:  Page heading (h1, WCAG 2.4.6), browser-tab title (WCAG 2.4.2, via React's
 *       <title> support) and an EmptyState naming the milestone.
 * WHEN: Every portal route in Milestone 1; each is replaced by its real page later.
 * SECURITY: Display only.
 */
import { EmptyState } from "@/components/common/EmptyState";
import { en } from "@/i18n/en";

export function PlaceholderPage({ title, milestone }: { title: string; milestone: number }) {
  return (
    <>
      <title>{`${title} · ${en.app.name}`}</title>
      <h1 className="mb-6 text-2xl font-bold text-ink">{title}</h1>
      <EmptyState title={en.placeholder.comingIn(milestone)} />
    </>
  );
}
