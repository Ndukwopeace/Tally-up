/**
 * What was entered, one line per product and unit, e.g. "Big Bread: 10 Caisses" (ADM-02).
 *
 * WHY:  A card must say exactly what was collected or handed over, in the units
 *       people used, so nobody has to open it to learn what "500 loaves" is made of
 *       (C-3). There is no combined total across products or units (REC-04).
 * HOW:  Lines sorted by product name, then Loaf, Pack, Caisse. A name the app cannot
 *       find (an unreadable product) shows a plain "Unknown product".
 * WHEN: Collection and distribution cards.
 * SECURITY: Display only.
 */
import { compareUnits } from "@/domain/units";
import { en } from "@/i18n/en";
import type { ProductQuantity } from "@/types/entities";

export function ProductLines({
  lines,
  names,
}: Readonly<{ lines: readonly ProductQuantity[]; names: ReadonlyMap<string, string> }>) {
  const label = (line: ProductQuantity) => names.get(line.productId) ?? en.ops.unknownProduct;
  const sorted = lines
    .filter((line) => line.quantity > 0)
    .sort((a, b) => label(a).localeCompare(label(b)) || compareUnits(a, b));
  if (sorted.length === 0) {
    return <span className="text-sm text-ink-muted">{en.ops.nothing}</span>;
  }
  return (
    <ul className="flex flex-col gap-0.5 text-sm text-ink">
      {sorted.map((line) => (
        <li key={`${line.productId}/${line.unit}`}>
          {label(line)}: <span className="font-semibold">{en.ops.amount(line.quantity, line.unit)}</span>
        </li>
      ))}
    </ul>
  );
}
