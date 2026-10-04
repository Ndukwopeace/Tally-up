/**
 * The loading, error, empty and "Load more" states shared by the admin lists (NFR-07).
 *
 * WHY:  Collections and Distributions behave the same way around their rows, so the
 *       states live once (DRY) and look the same everywhere (N4).
 * HOW:  Takes a few fields of an infinite query. While the first page loads: a
 *       skeleton. On failure: "Try again". With no rows: the empty state, or, when
 *       filters are on, a plain "no match" line. Otherwise the rows (children) and,
 *       while more exist, a "Load more" button that shows "Loading…" (Q-56).
 * WHEN: Collections and Distributions pages.
 * SECURITY: Display only.
 */
import type { ReactNode } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import { Button } from "@/components/ui/button";
import { en } from "@/i18n/en";

/** The parts of an infinite query this frame needs. */
export interface ListQuery {
  isPending: boolean;
  isError: boolean;
  refetch: () => unknown;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
}

export function ListFrame({
  query,
  count,
  filtered,
  empty,
  noMatch,
  children,
}: Readonly<{
  query: ListQuery;
  count: number;
  filtered: boolean;
  empty: { title: string; body: string };
  noMatch: string;
  children: ReactNode;
}>) {
  if (query.isPending) {
    return <PageSkeleton />;
  }
  if (query.isError) {
    return (
      <ErrorState
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (count === 0) {
    return filtered ? (
      <p className="text-base text-ink-muted">{noMatch}</p>
    ) : (
      <EmptyState title={empty.title} description={empty.body} />
    );
  }
  return (
    <>
      <ul className="flex flex-col gap-3">{children}</ul>
      {query.hasNextPage ? (
        <Button
          variant="secondary"
          size="block"
          disabled={query.isFetchingNextPage}
          onClick={() => {
            void query.fetchNextPage();
          }}
        >
          {query.isFetchingNextPage ? en.ops.loadingMore : en.ops.loadMore}
        </Button>
      ) : null}
    </>
  );
}
