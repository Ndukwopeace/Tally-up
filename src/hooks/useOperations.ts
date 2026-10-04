/**
 * TanStack Query hooks for the admin monitoring lists and detail pages
 * (ARCHITECTURE §3.3: server data lives in the query cache).
 *
 * WHY:  Pages get loading, error and success states (NFR-07), and "Load more"
 *       appends the next 25 rows to the list already on screen (Q-59g).
 * HOW:  `useCollections` and `useReceipts` are infinite queries over the
 *       OperationsService: the filters are part of the query key, so changing a
 *       filter starts a fresh list; the next page starts where the rows already
 *       loaded end. `useCollection` and `useReceipt` read one detail page.
 * WHEN: Home, Collections, Distributions, and their detail pages (A3b).
 * SECURITY: Data comes only from the service, which RLS filters. Read-only.
 */
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import {
  PAGE_SIZE,
  type CollectionFilters,
  type ReceiptFilters,
} from "@/services/interfaces/OperationsService";
import { useServices } from "@/services/ServicesProvider";

/** Query keys, in one place. */
export const operationsKeys = {
  collections: (filters: CollectionFilters) => ["operations", "collections", filters] as const,
  collection: (id: string) => ["operations", "collection", id] as const,
  receipts: (filters: ReceiptFilters) => ["operations", "receipts", filters] as const,
  receipt: (id: string) => ["operations", "receipt", id] as const,
  home: ["operations", "home"] as const,
};

export function useCollections(filters: CollectionFilters) {
  const { operations } = useServices();
  return useInfiniteQuery({
    queryKey: operationsKeys.collections(filters),
    queryFn: ({ pageParam }) => operations.listCollections(filters, pageParam),
    initialPageParam: 0,
    // The next page starts after the rows already loaded; none when the last page was short.
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length * PAGE_SIZE : undefined),
  });
}

export function useReceipts(filters: ReceiptFilters) {
  const { operations } = useServices();
  return useInfiniteQuery({
    queryKey: operationsKeys.receipts(filters),
    queryFn: ({ pageParam }) => operations.listReceipts(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length * PAGE_SIZE : undefined),
  });
}

export function useCollection(id: string) {
  const { operations } = useServices();
  return useQuery({ queryKey: operationsKeys.collection(id), queryFn: () => operations.getCollection(id) });
}

export function useReceipt(id: string) {
  const { operations } = useServices();
  return useQuery({ queryKey: operationsKeys.receipt(id), queryFn: () => operations.getReceipt(id) });
}

/** The admin Home numbers (ADM-01 to ADM-03, ADM-06). "Today" is decided when the page loads, in Douala time. */
export function useHome() {
  const { operations } = useServices();
  return useQuery({ queryKey: operationsKeys.home, queryFn: () => operations.getHome(new Date()) });
}
