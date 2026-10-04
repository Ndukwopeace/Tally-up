/**
 * Admin → Distributions: every hand-over to a depot and its receipt status (ADM-04, Q-47, Q-59g).
 *
 * WHY:  The admin sees where each distribution went and whether the depot confirmed
 *       it, including the ones that are still waiting (RCP-15) and the ones that
 *       came back with a discrepancy (Q-59e), without phoning anyone.
 * HOW:  Cards from useReceipts, newest first, 25 at a time. Filters (date from and
 *       to, depot, receipt status, and a "with discrepancy only" shortcut for that
 *       status) sit in a collapsible box and live in the page address; Home links
 *       here with the discrepancy filter on. A card shows the number, status, depot,
 *       distributor, when, what was recorded per unit as entered, and for a waiting
 *       receipt how long it has waited, flagged after 24 hours (Q-59f).
 * WHEN: /admin/distributions (the Distributions tab).
 * SECURITY: Read-only; RLS decides what an admin reads. Filter values from the
 *       address are checked before use.
 */
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { FlagChip } from "@/components/admin/FlagChip";
import { FilterPanel } from "@/components/admin/FilterPanel";
import { ListFrame } from "@/components/admin/ListFrame";
import { UnitTotals } from "@/components/admin/UnitTotals";
import { CheckboxField } from "@/components/common/CheckboxField";
import { SelectField } from "@/components/common/SelectField";
import { StatusBadge } from "@/components/common/StatusBadge";
import { TextField } from "@/components/common/TextField";
import { BUSINESS_RULES } from "@/config/business-rules";
import { isAgedReceipt, receiptAge } from "@/domain/flags";
import { useDepots } from "@/hooks/useDepots";
import { useReceipts } from "@/hooks/useOperations";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { en } from "@/i18n/en";
import { formatWhen } from "@/lib/format";
import { PageTitle } from "@/pages/PageTitle";
import type { ReceiptFilters } from "@/services/interfaces/OperationsService";
import type { ReceiptListItem } from "@/types/entities";
import { RECEIPT_STATUSES } from "@/types/enums";

const KEYS = ["from", "to", "depot", "status"] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DISCREPANCY = "confirmed_with_discrepancy";

// The address is untrusted: keep only a well-formed day and a known status.
function toFilters(values: Record<string, string>): ReceiptFilters {
  return {
    from: DAY.test(values.from ?? "") ? values.from : undefined,
    to: DAY.test(values.to ?? "") ? values.to : undefined,
    depotId: values.depot || undefined,
    status: RECEIPT_STATUSES.find((status) => status === values.status),
  };
}

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

function ReceiptCard({ item, now }: Readonly<{ item: ReceiptListItem; now: Date }>) {
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
          <span className="text-sm text-ink">
            {en.ops.receipts.recorded}: <UnitTotals totals={item.recorded} />
          </span>
          <WaitingNote item={item} now={now} />
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
      </Link>
    </li>
  );
}

export function DistributionsPage() {
  const { values, activeCount, set, clear } = useUrlFilters(KEYS);
  const query = useReceipts(toFilters(values));
  const depots = useDepots();
  const rows = query.data?.pages.flatMap((page) => page.rows) ?? [];
  const now = new Date();

  return (
    <>
      <PageTitle title={en.nav.distributions} />
      <div className="flex flex-col gap-4">
        <FilterPanel activeCount={activeCount} onClear={clear}>
          <TextField
            id="filter-from"
            label={en.ops.filters.from}
            type="date"
            value={values.from ?? ""}
            onValueChange={(v) => {
              set("from", v);
            }}
          />
          <TextField
            id="filter-to"
            label={en.ops.filters.to}
            type="date"
            value={values.to ?? ""}
            onValueChange={(v) => {
              set("to", v);
            }}
          />
          <SelectField
            id="filter-depot"
            label={en.ops.filters.depot}
            value={values.depot ?? ""}
            options={[
              { value: "", label: en.ops.filters.allDepots },
              ...(depots.data ?? []).map((depot) => ({ value: depot.id, label: depot.name })),
            ]}
            onValueChange={(v) => {
              set("depot", v);
            }}
          />
          <SelectField
            id="filter-status"
            label={en.ops.filters.status}
            value={values.status ?? ""}
            options={[
              { value: "", label: en.ops.filters.allStatuses },
              ...RECEIPT_STATUSES.map((status) => ({ value: status, label: en.status[status] })),
            ]}
            onValueChange={(v) => {
              set("status", v);
            }}
          />
          {/* Q-59e: a shortcut for the Confirmed with Discrepancy status. */}
          <CheckboxField
            label={en.ops.filters.withDiscrepancy}
            checked={values.status === DISCREPANCY}
            onCheckedChange={(on) => {
              set("status", on ? DISCREPANCY : "");
            }}
          />
        </FilterPanel>
        <ListFrame
          query={query}
          count={rows.length}
          filtered={activeCount > 0}
          empty={{ title: en.ops.receipts.emptyTitle, body: en.ops.receipts.emptyBody }}
          noMatch={en.ops.receipts.noMatch}
        >
          {rows.map((item) => (
            <ReceiptCard key={item.id} item={item} now={now} />
          ))}
        </ListFrame>
      </div>
    </>
  );
}
