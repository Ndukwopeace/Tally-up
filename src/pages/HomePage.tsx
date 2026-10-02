/**
 * A portal's home tab (admin Home, distributor and depot Dashboard).
 *
 * WHY:  The wireframes and spec §18/§25/§29 open each portal on today's
 *       activity, so the date is shown under the title from the start (in Douala
 *       time, Q-6). The content itself is built per role (Q-49: admin first).
 * WHEN: Index route of each portal.
 * SECURITY: Display only.
 */
import { PageTitle } from "./PageTitle";

import { ComingSoon } from "@/components/common/ComingSoon";
import { formatToday } from "@/lib/format";

export function HomePage({ title }: { title: string }) {
  return (
    <>
      <PageTitle title={title} subtitle={<span data-testid="today">{formatToday()}</span>} />
      <ComingSoon />
    </>
  );
}
