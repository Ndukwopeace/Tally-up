/**
 * Admin → Home: today's picture (ADM-01, ADM-02, ADM-03, ADM-06, Q-59c to Q-59f).
 *
 * WHY:  The admin opens the app to learn, without phoning anyone, what came in and
 *       went out today, what is still waiting, and whether anything went wrong
 *       (REQUIREMENTS §1).
 * HOW:  One load of the Home numbers (useHome), then four blocks:
 *       - six KPI cards: Collected Today and Distributed Today per unit as entered
 *         (no combined total, ADM-02); Remaining to Distribute per product in loaves
 *         with the breakdown (Q-59d); Awaiting Confirmation and Discrepancies count
 *         every open item; Confirmed Receipts counts today's (Q-59c);
 *       - "Needs attention": receipts waiting and collections in progress over 24
 *         hours (ADM-06, Q-59f), shown only when there are some;
 *       - the 5 latest discrepancies, each opening its receipt, and a link to the
 *         full list in Distributions (Q-59e). Discrepancies are never hidden or
 *         cleared here (ADM-05);
 *       - Today's activity: today's collections (ADM-03).
 *       "Today" is the Douala day (Q-6).
 * WHEN: /admin (the Home tab).
 * SECURITY: Read-only; RLS decides what an admin reads.
 */
import { Link } from "react-router";

import { CollectionCard } from "@/components/admin/CollectionCard";
import { KpiCard } from "@/components/admin/KpiCard";
import { LoafBreakdown } from "@/components/admin/LoafBreakdown";
import { ReceiptCard } from "@/components/admin/ReceiptCard";
import { ErrorState } from "@/components/common/ErrorState";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import { BUSINESS_RULES } from "@/config/business-rules";
import { productUnits } from "@/domain/products";
import { useHome } from "@/hooks/useOperations";
import { useProducts } from "@/hooks/useProducts";
import { en } from "@/i18n/en";
import { formatToday } from "@/lib/format";
import { PageTitle } from "@/pages/PageTitle";
import type { HomeData, Product, UnitQuantity } from "@/types/entities";

const t = en.ops.home;

// Totals per unit as entered, "500 Loaves · 10 Caisses"; "Nothing" when there are none (ADM-02).
function unitsText(totals: readonly UnitQuantity[]): string {
  return totals.length === 0
    ? en.ops.nothing
    : totals.map((total) => en.ops.amount(total.quantity, total.unit)).join(" · ");
}

function RemainingList({
  home,
  products,
}: Readonly<{ home: HomeData; products: ReadonlyMap<string, Product> }>) {
  if (home.remaining.length === 0) {
    return <span>{t.remainingNone}</span>;
  }
  return (
    <ul className="flex flex-col gap-1 text-base font-semibold">
      {home.remaining.map((entry) => {
        const product = products.get(entry.productId);
        const units = product ? productUnits(product) : [{ unit: "Loaf" as const, loaves: 1 }];
        return (
          <li key={entry.productId}>
            {product?.name ?? en.ops.unknownProduct}:{" "}
            <LoafBreakdown loaves={entry.remainingLoaves} units={units} />
          </li>
        );
      })}
    </ul>
  );
}

function Block({
  title,
  link,
  children,
}: Readonly<{ title: string; link?: { to: string; label: string }; children: React.ReactNode }>) {
  return (
    <section aria-label={title} className="mt-8 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {link ? (
          <Link to={link.to} className="text-base font-semibold text-brand underline">
            {link.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function AdminHomePage() {
  const { data: home, isPending, isError, refetch } = useHome();
  const productList = useProducts();

  const title = <PageTitle title={en.nav.home} subtitle={<span data-testid="today">{formatToday()}</span>} />;
  if (isPending) {
    return (
      <>
        {title}
        <PageSkeleton rows={6} />
      </>
    );
  }
  if (isError) {
    return (
      <>
        {title}
        <ErrorState
          message={t.loadFailed}
          onRetry={() => {
            void refetch();
          }}
        />
      </>
    );
  }

  const now = new Date();
  const products = new Map((productList.data ?? []).map((product) => [product.id, product]));
  const names = new Map((productList.data ?? []).map((product) => [product.id, product.name]));
  const hasAttention = home.agedReceipts.count > 0 || home.staleCollections.count > 0;

  return (
    <>
      {title}
      <div
        role="group"
        aria-label={t.kpiGroup}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <KpiCard label={t.collectedToday}>{unitsText(home.collectedToday)}</KpiCard>
        <KpiCard label={t.distributedToday}>{unitsText(home.distributedToday)}</KpiCard>
        <KpiCard label={t.remaining}>
          <RemainingList home={home} products={products} />
        </KpiCard>
        <KpiCard
          label={t.awaiting}
          note={t.awaitingNote}
          to="/admin/distributions?status=awaiting_confirmation"
        >
          {String(home.awaitingCount)}
        </KpiCard>
        <KpiCard label={t.confirmed} note={t.confirmedNote}>
          {String(home.confirmedTodayCount)}
        </KpiCard>
        <KpiCard
          label={t.discrepancies}
          note={t.discrepanciesNote}
          to="/admin/distributions?status=confirmed_with_discrepancy"
          tone={home.discrepancyCount > 0 ? "danger" : undefined}
        >
          {String(home.discrepancyCount)}
        </KpiCard>
      </div>

      {hasAttention ? (
        <Block title={t.attentionTitle}>
          {home.agedReceipts.count > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-base font-semibold text-ink">
                {t.agedTitle(home.agedReceipts.count, BUSINESS_RULES.agedReceiptHours)}
              </p>
              <ul className="flex flex-col gap-3">
                {home.agedReceipts.rows.map((item) => (
                  <ReceiptCard key={item.id} item={item} now={now} names={names} />
                ))}
              </ul>
              <Link
                to="/admin/distributions?status=awaiting_confirmation"
                className="text-base font-semibold text-brand underline"
              >
                {t.allReceipts}
              </Link>
            </div>
          ) : null}
          {home.staleCollections.count > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-base font-semibold text-ink">
                {t.staleTitle(home.staleCollections.count, BUSINESS_RULES.staleCollectionHours)}
              </p>
              <ul className="flex flex-col gap-3">
                {home.staleCollections.rows.map((item) => (
                  <CollectionCard key={item.id} item={item} now={now} names={names} />
                ))}
              </ul>
              <Link
                to="/admin/collections?status=in_progress"
                className="text-base font-semibold text-brand underline"
              >
                {t.allCollections}
              </Link>
            </div>
          ) : null}
        </Block>
      ) : null}

      <Block
        title={t.discrepancyTitle}
        link={
          home.discrepancyCount > 0
            ? {
                to: "/admin/distributions?status=confirmed_with_discrepancy",
                label: t.allDiscrepancies(home.discrepancyCount),
              }
            : undefined
        }
      >
        {home.latestDiscrepancies.length === 0 ? (
          <p className="text-base text-ink-muted">{t.noDiscrepancies}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {home.latestDiscrepancies.map((item) => (
              <ReceiptCard key={item.id} item={item} now={now} names={names} />
            ))}
          </ul>
        )}
      </Block>

      <Block title={t.activityTitle} link={{ to: "/admin/collections", label: t.allCollections }}>
        {home.todayCollections.length === 0 ? (
          <p className="text-base text-ink-muted">{t.noActivity}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {home.todayCollections.map((item) => (
              <CollectionCard key={item.id} item={item} now={now} names={names} />
            ))}
          </ul>
        )}
      </Block>
    </>
  );
}
