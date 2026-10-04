/**
 * One hand-over as a card: number, status, depot, who and when, what was handed over (ADM-04, RCP-15).
 *
 * WHY:  The Distributions list and Home's discrepancies and alerts show the same
 *       card, so a receipt looks the same wherever the admin meets it.
 * HOW:  A link to the receipt's page. One line per product and unit as handed
 *       over, and for a receipt still waiting, how long it has waited, flagged
 *       after 24 hours (Q-59f).
 * WHEN: Distributions list (A3b), Home (A3b-2).
 * SECURITY: Display only.
 */
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { FlagChip } from "@/components/admin/FlagChip";
import { ProductLines } from "@/components/admin/ProductLines";
import { StatusBadge } from "@/components/common/StatusBadge";
import { BUSINESS_RULES } from "@/config/business-rules";
import { isAgedReceipt, receiptAge } from "@/domain/flags";
import { en } from "@/i18n/en";
import { formatWhen } from "@/lib/format";
import type { ReceiptListItem } from "@/types/entities";

// RCP-15: how long a waiting receipt has waited, flagged once it is over the limit.
function WaitingNote({ item, now }: Readonly<{ item: ReceiptListItem; now: Date }>) {
  if (item.status !== "awaiting_confirmation") {
    return null;
  }
  const age = en.ops.age(receiptAge(item.createdAt, now));
  return isAgedReceipt(item.createdAt, item.status, now) ? (
    <FlagChip>{en.ops.receipts.aged(age, BUSINESS_RULES.agedReceiptHours)}</FlagChip>
  ) : (
    <span className="text-sm text-ink-muted">{en.ops.receipts.waiting(age)}</span>
  );
}

export function ReceiptCard({
  item,
  now,
  names,
}: Readonly<{ item: ReceiptListItem; now: Date; names: ReadonlyMap<string, string> }>) {
  return (
    <li>
      <Link
        to={`/admin/distributions/${item.id}`}
        className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-3 shadow-sm hover:border-brand active:bg-canvas"
      >
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-ink">{item.label}</span>
            <StatusBadge status={item.status} />
          </span>
          <span className="text-base font-semibold break-words text-ink">
            {item.depotName ?? en.ops.unknownDepot}
          </span>
          <span className="text-sm text-ink-muted">
            {item.distributorName ?? en.ops.unknownPerson} · {formatWhen(item.createdAt, now)}
          </span>
          <ProductLines lines={item.recorded} names={names} />
          <WaitingNote item={item} now={now} />
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
      </Link>
    </li>
  );
}
