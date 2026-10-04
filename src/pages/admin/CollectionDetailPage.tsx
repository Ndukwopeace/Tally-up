/**
 * Admin → Collections → one collection (ADM-04).
 *
 * WHY:  The admin opens a collection from the list to see exactly what was collected,
 *       how the bread was split across depots, and how each depot's count came out.
 * HOW:  Loads the collection (skeleton, error, not found). Shows its number, status,
 *       distributor and when, flags it if it has been In Progress for over 24 hours
 *       (COL-11), then the lines, the balance per product, and the depot allocations
 *       (CollectionDetailParts). Product names come from the product list.
 * WHEN: /admin/collections/:collectionId, from the Collections list.
 * SECURITY: Read-only; RLS decides what an admin reads. A record that does not exist
 *       or is not visible shows "not found".
 */
import { Link, useParams } from "react-router";

import { FlagChip } from "@/components/admin/FlagChip";
import { ErrorState } from "@/components/common/ErrorState";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import { StatusBadge } from "@/components/common/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { BUSINESS_RULES } from "@/config/business-rules";
import { isStaleCollection } from "@/domain/flags";
import { useCollection } from "@/hooks/useOperations";
import { useProducts } from "@/hooks/useProducts";
import { en } from "@/i18n/en";
import { formatWhen } from "@/lib/format";
import { AllocationsSection, BalanceSection, LinesSection } from "@/pages/admin/CollectionDetailParts";
import { PageTitle } from "@/pages/PageTitle";

export function CollectionDetailPage() {
  const { collectionId = "" } = useParams();
  const { data: detail, isPending, isError, refetch } = useCollection(collectionId);
  const products = useProducts();

  if (isPending) {
    return <PageSkeleton />;
  }
  if (isError) {
    return (
      <ErrorState
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }
  if (detail === null) {
    return (
      <>
        <PageTitle title={en.ops.collections.notFoundTitle} subtitle={en.ops.collections.notFoundBody} />
        <Link to="/admin/collections" className={buttonVariants({ variant: "secondary" })}>
          {en.ops.collections.backToList}
        </Link>
      </>
    );
  }

  const now = new Date();
  const { collection } = detail;
  const byId = new Map((products.data ?? []).map((product) => [product.id, product]));
  const names = new Map((products.data ?? []).map((product) => [product.id, product.name]));
  const rows: [string, string][] = [
    [en.ops.collections.distributor, collection.distributorName ?? en.ops.unknownPerson],
    [en.ops.collections.when, formatWhen(collection.createdAt, now)],
  ];

  return (
    <>
      <PageTitle title={collection.label} subtitle={<StatusBadge status={collection.status} />} />
      <dl className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5 px-4 py-3">
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className="text-base font-semibold break-words text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {isStaleCollection(collection.createdAt, collection.status, now) ? (
        <div className="mt-3">
          <FlagChip>{en.ops.collections.stale(BUSINESS_RULES.staleCollectionHours)}</FlagChip>
        </div>
      ) : null}
      <LinesSection detail={detail} names={names} />
      <BalanceSection detail={detail} products={byId} />
      <AllocationsSection detail={detail} now={now} />
    </>
  );
}
