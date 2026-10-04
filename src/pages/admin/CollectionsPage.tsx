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
import { CollectionCard } from "@/components/admin/CollectionCard";
import { FilterPanel } from "@/components/admin/FilterPanel";
import { ListFrame } from "@/components/admin/ListFrame";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { useCollections } from "@/hooks/useOperations";
import { useProducts } from "@/hooks/useProducts";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useUsers } from "@/hooks/useUsers";
import { en } from "@/i18n/en";
import { PageTitle } from "@/pages/PageTitle";
import type { CollectionFilters } from "@/services/interfaces/OperationsService";
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
