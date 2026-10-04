/**
 * The two sections of the collection detail page: lines and depot allocations (ADM-04).
 *
 * WHY:  The page answers "what did the distributor collect, where did it go, and did
 *       each depot confirm?" (REQUIREMENTS §1) in two short blocks that read top to bottom.
 * HOW:  - Lines: product, unit and quantity as entered, with the loaves, and a
 *         "Corrected" marker (with the original) where an admin changed it (COR-04).
 *       - Depot allocations: the hand-overs grouped by depot, each with exactly what
 *         was handed over (product, unit, quantity), its receipt status, how long it
 *         has waited if it still is, and a link to its receipt.
 *       No remaining figure is shown here (owner, 2026-10-04): a collection records
 *       what was collected, a distribution records what was handed over.
 * WHEN: Rendered by CollectionDetailPage.
 * SECURITY: Display only.
 */
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { CorrectedMark } from "@/components/admin/CorrectedMark";
import { FlagChip } from "@/components/admin/FlagChip";
import { ProductLines } from "@/components/admin/ProductLines";
import { StatusBadge } from "@/components/common/StatusBadge";
import { BUSINESS_RULES } from "@/config/business-rules";
import { isAgedReceipt, receiptAge } from "@/domain/flags";
import { en } from "@/i18n/en";
import { formatWhen } from "@/lib/format";
import type { CollectionDetail } from "@/types/entities";

const CARD = "flex flex-col gap-1 rounded-card border border-line bg-surface px-4 py-3";

function Section({
  id,
  title,
  children,
}: Readonly<{ id: string; title: string; children: React.ReactNode }>) {
  return (
    <section aria-labelledby={id} className="mt-8 flex flex-col gap-3">
      <h2 id={id} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LinesSection({
  detail,
  names,
}: Readonly<{ detail: CollectionDetail; names: Map<string, string> }>) {
  return (
    <Section id="collection-lines" title={en.ops.collections.linesTitle}>
      <ul className="flex flex-col gap-3">
        {detail.lines.map((line) => (
          <li key={line.id} className={CARD}>
            <span className="text-base font-semibold break-words text-ink">
              {names.get(line.productId) ?? en.ops.unknownProduct}
            </span>
            <span className="text-base text-ink">
              {en.ops.amountWithLoaves([{ unit: line.unit, quantity: line.quantity }], line.loaves)}
            </span>
            {line.isCorrected ? (
              <CorrectedMark was={en.ops.amount(line.originalQuantity, line.unit)} />
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function AllocationsSection({
  detail,
  names,
  now,
}: Readonly<{ detail: CollectionDetail; names: ReadonlyMap<string, string>; now: Date }>) {
  // ADM-04: grouped by depot, in the order the newest hand-over to each depot appears.
  const groups = new Map<string, { name: string; receipts: CollectionDetail["receipts"] }>();
  for (const receipt of detail.receipts) {
    const group = groups.get(receipt.depotId) ?? {
      name: receipt.depotName ?? en.ops.unknownDepot,
      receipts: [],
    };
    group.receipts.push(receipt);
    groups.set(receipt.depotId, group);
  }
  return (
    <Section id="collection-allocations" title={en.ops.collections.allocationsTitle}>
      {groups.size === 0 ? (
        <p className="text-base text-ink-muted">{en.ops.collections.noAllocations}</p>
      ) : null}
      {[...groups.entries()].map(([depotId, group]) => (
        <div key={depotId} className="flex flex-col gap-2">
          <h3 className="text-base font-semibold break-words text-ink">{group.name}</h3>
          <ul className="flex flex-col gap-2">
            {group.receipts.map((receipt) => (
              <li key={receipt.id}>
                <Link
                  to={`/admin/collections/${detail.collection.id}/receipts/${receipt.id}`}
                  className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-3 hover:border-brand active:bg-canvas"
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-ink">{receipt.label}</span>
                      <StatusBadge status={receipt.status} />
                    </span>
                    <span className="text-sm text-ink-muted">{formatWhen(receipt.createdAt, now)}</span>
                    <ProductLines lines={receipt.recorded} names={names} />
                    {isAgedReceipt(receipt.createdAt, receipt.status, now) ? (
                      <FlagChip>
                        {en.ops.receipts.aged(
                          en.ops.age(receiptAge(receipt.createdAt, now)),
                          BUSINESS_RULES.agedReceiptHours,
                        )}
                      </FlagChip>
                    ) : null}
                  </span>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Section>
  );
}
