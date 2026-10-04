/**
 * Quantities per unit as they were entered, e.g. "500 Loaves · 10 Caisses" (ADM-02).
 *
 * WHY:  The admin reads what people recorded, in the units they used. There is no
 *       combined grand total across units (ADM-02, REC-04), and every number
 *       carries its unit (C-3).
 * HOW:  One text line, units in Loaf, Pack, Caisse order, joined with a middle dot.
 *       Nothing at all shows the "nothing" word, so an empty value is never a bare dash.
 * WHEN: Collection and receipt cards and detail pages.
 * SECURITY: Display only.
 */
import { en } from "@/i18n/en";
import type { UnitQuantity } from "@/types/entities";

export function UnitTotals({ totals, empty }: Readonly<{ totals: readonly UnitQuantity[]; empty?: string }>) {
  const shown = totals.filter((total) => total.quantity > 0);
  if (shown.length === 0) {
    return <span>{empty ?? en.ops.nothing}</span>;
  }
  return <span>{shown.map((total) => en.ops.amount(total.quantity, total.unit)).join(" · ")}</span>;
}
