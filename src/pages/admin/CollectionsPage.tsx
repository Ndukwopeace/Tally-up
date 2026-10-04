/**
 * Admin → Collections: every collection, newest first (ADM-03, Q-47, Q-59g).
 *
 * WHY:  The admin sees what each distributor collected, per product, and whether
 *       it is still In Progress, without phoning anyone (REQUIREMENTS §1). Hand-overs
 *       and what remains are on the collection's own page, not on the card.
 * HOW:  Cards (phone-first, NFR-08) from useCollections, 25 at a time with "Load
 *       more". Filters (date from and to, distributor, status) sit in a collapsible
 *       box and live in the page address, so a filtered list can be shared. Each
 *       card shows the number, status, distributor, when, collected and handed over
 *       per unit as entered, loaves remaining, and a flag when it has been In
 *       Progress for over 24 hours (COL-11). A card opens the collection's page.
 * WHEN: /admin/collections (the Collections tab).
 * SECURITY: Read-only; RLS decides what an admin reads. Filter values from the
 *       address are checked before use.
 */
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { FlagChip } from "@/components/admin/FlagChip";
import { FilterPanel } from "@/components/admin/FilterPanel";
import { ListFrame } from "@/components/admin/ListFrame";
import { ProductLines } from "@/components/admin/ProductLines";
import { SelectField } from "@/components/common/SelectField";
import { StatusBadge } from "@/components/common/StatusBadge";
import { TextField } from "@/components/common/TextField";
import { BUSINESS_RULES } from "@/config/business-rules";
import { isStaleCollection } from "@/domain/flags";
import { useCollections } from "@/hooks/useOperations";
import { useProducts } from "@/hooks/useProducts";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useUsers } from "@/hooks/useUsers";
import { en } from "@/i18n/en";
import { formatWhen } from "@/lib/format";
import { PageTitle } from "@/pages/PageTitle";
import type { CollectionFilters } from "@/services/interfaces/OperationsService";
import type { CollectionListItem } from "@/types/entities";
import { COLLECTION_STATUSES } from "@/types/enums";

const KEYS = ["from", "to", "distributor", "status"] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// The address is untrusted: keep only a well-formed day and a known status.
function toFilters(values: Record<string, string>): CollectionFilters {
  return {
    from: DAY.test(values.from ?? "") ? values.from : undefined,
    to: DAY.test(values.to ?? "") ? values.to : undefined,
    distributorId: values.distributor || undefined,
    status: COLLECTION_STATUSES.find((status) => status === values.status),
  };
}

function CollectionCard({
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

export function CollectionsPage() {
  const { values, activeCount, set, clear } = useUrlFilters(KEYS);
  const query = useCollections(toFilters(values));
  const people = useUsers();
  const products = useProducts();
  const names = new Map((products.data ?? []).map((product) => [product.id, product.name]));
  const rows = query.data?.pages.flatMap((page) => page.rows) ?? [];
  const now = new Date();

  const distributors = (people.data ?? []).filter((user) => user.role === "distributor");
  return (
    <>
      <PageTitle title={en.nav.collections} />
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
            id="filter-distributor"
            label={en.ops.filters.distributor}
            value={values.distributor ?? ""}
            options={[
              { value: "", label: en.ops.filters.allDistributors },
              ...distributors.map((user) => ({ value: user.id, label: user.fullName })),
            ]}
            onValueChange={(v) => {
              set("distributor", v);
            }}
          />
          <SelectField
            id="filter-status"
            label={en.ops.filters.status}
            value={values.status ?? ""}
            options={[
              { value: "", label: en.ops.filters.allStatuses },
              ...COLLECTION_STATUSES.map((status) => ({ value: status, label: en.status[status] })),
            ]}
            onValueChange={(v) => {
              set("status", v);
            }}
          />
        </FilterPanel>
        <ListFrame
          query={query}
          count={rows.length}
          filtered={activeCount > 0}
          empty={{ title: en.ops.collections.emptyTitle, body: en.ops.collections.emptyBody }}
          noMatch={en.ops.collections.noMatch}
        >
          {rows.map((item) => (
            <CollectionCard key={item.id} item={item} now={now} names={names} />
          ))}
        </ListFrame>
      </div>
    </>
  );
}
