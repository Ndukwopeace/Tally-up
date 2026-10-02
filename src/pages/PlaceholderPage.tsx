/**
 * A page whose content is not built yet: real title, "Coming soon" card.
 *
 * WHY:  Every route shows its real name instead of a blank screen (spec §49),
 *       without developer wording (UI review #7).
 * WHEN: Every portal route whose screen is not built yet.
 * SECURITY: Display only.
 */
import { PageTitle } from "./PageTitle";

import { ComingSoon } from "@/components/common/ComingSoon";

export function PlaceholderPage({ title }: Readonly<{ title: string }>) {
  return (
    <>
      <PageTitle title={title} />
      <ComingSoon />
    </>
  );
}
