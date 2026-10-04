/**
 * Loaves with their breakdown, e.g. "430 Loaves (8 Caisses + 3 Packs)" (DIS-02, Q-27).
 *
 * WHY:  Remaining is counted in loaves, but people think in Caisses and Packs, so
 *       the amount is shown both ways. The system does the conversion (T-1).
 * HOW:  Splits the loaves into the product's own units, largest first, using the
 *       product's loaves per Pack and per Caisse (domain/units.ts). When the whole
 *       amount is loose loaves, no breakdown is added.
 * WHEN: Balances per product on the collection detail page (and Home, A3b-2).
 * SECURITY: Display only; no I/O.
 */
import { breakdown } from "@/domain/units";
import { en } from "@/i18n/en";
import type { ProductUnitLoaves } from "@/types/entities";

export function LoafBreakdown({
  loaves,
  units,
}: Readonly<{ loaves: number; units: readonly ProductUnitLoaves[] }>) {
  const parts = breakdown(loaves, units);
  const onlyLoaves = parts.length === 0 || (parts.length === 1 && parts[0]?.unit === "Loaf");
  return (
    <span>
      {en.ops.loaves(loaves)}
      {onlyLoaves ? "" : ` (${parts.map((part) => en.ops.amount(part.quantity, part.unit)).join(" + ")})`}
    </span>
  );
}
