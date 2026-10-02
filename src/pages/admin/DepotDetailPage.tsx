/**
 * Admin → Depots → one depot (DEP-02, DEP-05).
 *
 * WHY:  The admin checks a depot's details, manager and phone numbers, and
 *       (from A3) its history of hand-overs and receipts (DEP-05).
 * HOW:  Loads the depot (skeleton, error, not found). Shows location, address,
 *       manager, phone numbers as tap-to-call links, status, an "Edit depot"
 *       button, and the history section, which says plainly that history
 *       appears once distributors record hand-overs (built in A3/D1).
 * WHEN: /admin/depots/:depotId, from the Depots list.
 * SECURITY: Read-only; RLS decides what an admin reads.
 */
import { Pencil } from "lucide-react";
import { Link, useParams } from "react-router";

import { ErrorState } from "@/components/common/ErrorState";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import { RecordStatusLabel } from "@/components/common/RecordStatusLabel";
import { buttonVariants } from "@/components/ui/button";
import { formatCameroonPhone } from "@/domain/phone";
import { useDepot } from "@/hooks/useDepots";
import { en } from "@/i18n/en";
import { PageTitle } from "@/pages/PageTitle";

export function DepotDetailPage() {
  const { depotId = "" } = useParams();
  const { data: depot, isPending, isError, refetch } = useDepot(depotId);

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
  if (depot === null) {
    return (
      <>
        <PageTitle title={en.depots.notFoundTitle} subtitle={en.depots.notFoundBody} />
        <Link to="/admin/depots" className={buttonVariants({ variant: "secondary" })}>
          {en.depots.backToList}
        </Link>
      </>
    );
  }

  const rows: [string, string][] = [
    [en.depots.location, depot.location],
    [en.depots.address, depot.address],
    [en.depots.manager, depot.manager?.fullName ?? en.depots.noManager],
  ];

  return (
    <>
      <PageTitle title={depot.name} subtitle={<RecordStatusLabel status={depot.status} />} />
      <dl className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5 px-4 py-3">
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className="text-base font-semibold break-words text-ink">{value}</dd>
          </div>
        ))}
        <div className="flex flex-col gap-0.5 px-4 py-3">
          <dt className="text-sm text-ink-muted">{en.depots.phonesTitle}</dt>
          <dd className="flex flex-col gap-1 text-base font-semibold text-ink">
            {depot.phones.length === 0
              ? en.depots.noPhones
              : depot.phones.map((phone) => (
                  // tel: links let the admin call the depot with one tap.
                  <a
                    key={phone}
                    href={`tel:${phone}`}
                    className="text-brand underline-offset-4 hover:underline"
                  >
                    {formatCameroonPhone(phone)}
                  </a>
                ))}
          </dd>
        </div>
      </dl>

      <Link to={`/admin/depots/${depot.id}/edit`} className={`${buttonVariants({ size: "block" })} mt-6`}>
        <Pencil aria-hidden="true" className="size-5" />
        {en.depots.edit}
      </Link>

      {/* RULE DEP-05: the depot's history; filled once hand-overs exist (A3 / D1). */}
      <section aria-labelledby="depot-history" className="mt-8 flex flex-col gap-2">
        <h2 id="depot-history" className="text-lg font-semibold text-ink">
          {en.depots.historyTitle}
        </h2>
        <p className="text-base text-ink-muted">{en.depots.historyEmpty}</p>
      </section>
    </>
  );
}
