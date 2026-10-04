/**
 * One collection as a card: number, status, who and when, what was collected (ADM-03, COL-11).
 *
 * WHY:  The Collections list and Home's Today's Activity and alerts show the same
 *       card, so a collection looks the same wherever the admin meets it.
 * HOW:  A link to the collection's page. One line per product and unit as
 *       collected (no handed-over or remaining figure, owner 2026-10-04), and a
 *       flag when it has been In Progress for over 24 hours.
 * WHEN: Collections list (A3b), Home (A3b-2).
 * SECURITY: Display only.
 */
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { FlagChip } from "@/components/admin/FlagChip";
import { ProductLines } from "@/components/admin/ProductLines";
import { StatusBadge } from "@/components/common/StatusBadge";
import { BUSINESS_RULES } from "@/config/business-rules";
import { isStaleCollection } from "@/domain/flags";
import { en } from "@/i18n/en";
import { formatWhen } from "@/lib/format";
import type { CollectionListItem } from "@/types/entities";

export function CollectionCard({
  item,
  now,
  names,
}: Readonly<{ item: CollectionListItem; now: Date; names: ReadonlyMap<string, string> }>) {
  return (
    <li>
      <Link
        to={`/admin/collections/${item.id}`}
        className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-3 shadow-sm hover:border-brand active:bg-canvas"
      >
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-ink">{item.label}</span>
            <StatusBadge status={item.status} />
          </span>
          <span className="text-sm text-ink-muted">
            {item.distributorName ?? en.ops.unknownPerson} · {formatWhen(item.createdAt, now)}
          </span>
          <ProductLines lines={item.collected} names={names} />
          {isStaleCollection(item.createdAt, item.status, now) ? (
            <FlagChip>{en.ops.collections.stale(BUSINESS_RULES.staleCollectionHours)}</FlagChip>
          ) : null}
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
      </Link>
    </li>
  );
}
