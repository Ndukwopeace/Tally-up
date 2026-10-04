/**
 * Admin → one receipt: what the distributor recorded against what the depot counted (RCP-02, RCP-10, REC-02, ADM-04).
 *
 * WHY:  The receipt is where a discrepancy shows. The admin sees, line by line, what
 *       was recorded, what the manager counted (in the units they counted, RCP-06),
 *       and the difference in loaves, with the manager's comment.
 * HOW:  Loads the receipt (skeleton, error, not found). Header: depot, distributor,
 *       date and time, receipt number and collection, status, and, while waiting, how
 *       long it has waited (flagged after 24 hours, RCP-15). Then one card per line:
 *       recorded, counted, and "Match" or "Difference: −5 Loaves" with an icon and
 *       text (WCAG 1.4.1). Corrected values carry a "Corrected, was …" marker (COR-04).
 *       The same page serves /admin/distributions/:receiptId and
 *       /admin/collections/:collectionId/receipts/:receiptId, so Back stays in its tab (Q-56).
 * WHEN: From the Distributions list and from a collection's depot allocations.
 * SECURITY: Read-only; RLS decides what an admin reads. Corrections are made in A3c.
 */
import { CircleCheck, TriangleAlert } from "lucide-react";
import { Link, useParams } from "react-router";

import { CorrectedMark } from "@/components/admin/CorrectedMark";
import { FlagChip } from "@/components/admin/FlagChip";
import { ErrorState } from "@/components/common/ErrorState";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import { StatusBadge } from "@/components/common/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { BUSINESS_RULES } from "@/config/business-rules";
import { isAgedReceipt, receiptAge } from "@/domain/flags";
import { useReceipt } from "@/hooks/useOperations";
import { useProducts } from "@/hooks/useProducts";
import { en } from "@/i18n/en";
import { formatWhen } from "@/lib/format";
import { PageTitle } from "@/pages/PageTitle";
import type { ReceiptLineDetail } from "@/types/entities";

// RULE REC-02: the difference in loaves, as icon + text, never colour alone.
function Difference({ loaves }: Readonly<{ loaves: number }>) {
  const matches = loaves === 0;
  const Icon = matches ? CircleCheck : TriangleAlert;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-base font-semibold ${matches ? "text-success" : "text-danger"}`}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      {matches ? en.ops.receipts.match : `${en.ops.receipts.differs}: ${en.ops.signedLoaves(loaves)}`}
    </span>
  );
}

function LineCard({ line, name }: Readonly<{ line: ReceiptLineDetail; name: string }>) {
  return (
    <li className="flex flex-col gap-1.5 rounded-card border border-line bg-surface px-4 py-3">
      <span className="text-base font-semibold break-words text-ink">{name}</span>
      <span className="text-sm text-ink">
        {en.ops.receipts.recorded}:{" "}
        {en.ops.amountWithLoaves([{ unit: line.unit, quantity: line.recordedQuantity }], line.recordedLoaves)}
      </span>
      {line.recordedIsCorrected ? (
        <CorrectedMark was={en.ops.amount(line.originalRecordedQuantity, line.unit)} />
      ) : null}
      {line.counts === null || line.countedLoaves === null || line.differenceLoaves === null ? (
        <span className="text-sm text-ink-muted">{en.ops.receipts.notCounted}</span>
      ) : (
        <>
          <span className="text-sm text-ink">
            {en.ops.receipts.countTitle}: {en.ops.amountWithLoaves(line.counts, line.countedLoaves)}
          </span>
          {line.counts
            .filter((count) => count.isCorrected)
            .map((count) => (
              <CorrectedMark key={count.unit} was={en.ops.amount(count.originalQuantity, count.unit)} />
            ))}
          <Difference loaves={line.differenceLoaves} />
        </>
      )}
    </li>
  );
}

export function ReceiptDetailPage() {
  const { receiptId = "" } = useParams();
  const { data: detail, isPending, isError, refetch } = useReceipt(receiptId);
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
        <PageTitle title={en.ops.receipts.notFoundTitle} subtitle={en.ops.receipts.notFoundBody} />
        <Link to="/admin/distributions" className={buttonVariants({ variant: "secondary" })}>
          {en.ops.receipts.backToList}
        </Link>
      </>
    );
  }

  const now = new Date();
  const { receipt } = detail;
  const names = new Map((products.data ?? []).map((product) => [product.id, product.name]));
  const rows: [string, string][] = [
    [en.ops.receipts.depot, receipt.depotName ?? en.ops.unknownDepot],
    [en.ops.receipts.distributor, receipt.distributorName ?? en.ops.unknownPerson],
    [en.ops.receipts.when, formatWhen(receipt.createdAt, now)],
    [en.ops.receipts.collection, receipt.collectionLabel ?? en.ops.unknownPerson],
  ];

  return (
    <>
      <PageTitle title={receipt.label} subtitle={<StatusBadge status={receipt.status} />} />
      <dl className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5 px-4 py-3">
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className="text-base font-semibold break-words text-ink">{value}</dd>
          </div>
        ))}
        {receipt.confirmedAt ? (
          <div className="flex flex-col gap-0.5 px-4 py-3">
            <dt className="text-sm text-ink-muted">{en.ops.receipts.confirmedAt}</dt>
            <dd className="text-base font-semibold text-ink">{formatWhen(receipt.confirmedAt, now)}</dd>
          </div>
        ) : null}
      </dl>
      {isAgedReceipt(receipt.createdAt, receipt.status, now) ? (
        <div className="mt-3">
          <FlagChip>
            {en.ops.receipts.aged(
              en.ops.age(receiptAge(receipt.createdAt, now)),
              BUSINESS_RULES.agedReceiptHours,
            )}
          </FlagChip>
        </div>
      ) : null}

      <section aria-labelledby="receipt-lines" className="mt-8 flex flex-col gap-3">
        <h2 id="receipt-lines" className="text-lg font-semibold text-ink">
          {en.ops.receipts.recordedTitle}
        </h2>
        <ul className="flex flex-col gap-3">
          {detail.lines.map((line) => (
            <LineCard
              key={line.itemId}
              line={line}
              name={names.get(line.productId) ?? en.ops.unknownProduct}
            />
          ))}
        </ul>
      </section>

      <section aria-labelledby="receipt-comment" className="mt-8 flex flex-col gap-2">
        <h2 id="receipt-comment" className="text-lg font-semibold text-ink">
          {en.ops.receipts.commentTitle}
        </h2>
        <p className="text-base text-ink">{detail.comment ?? en.ops.receipts.noComment}</p>
        {detail.commentIsCorrected ? <CorrectedMark /> : null}
      </section>
    </>
  );
}
