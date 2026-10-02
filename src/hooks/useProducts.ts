/**
 * TanStack Query hooks for products (ARCHITECTURE §3.3: server data lives in the query cache).
 *
 * WHY:  Pages need loading, error and success states for free (NFR-07), and a
 *       saved product must show up in the list without a manual refresh.
 * HOW:  `useProducts` and `useProduct` read through the ProductService;
 *       `useSaveProduct` saves and then marks every product query stale.
 * WHEN: Products list and form (A2a); later the distributor's product picker.
 * SECURITY: Data comes only from the service, which RLS filters.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ProductSaveInput } from "@/domain/products";
import type { ProductError } from "@/services/interfaces/ProductService";
import { useServices } from "@/services/ServicesProvider";

/** Query keys for products, in one place so saves can invalidate them. */
export const productKeys = {
  all: ["products"] as const,
  one: (id: string) => ["products", id] as const,
};

export function useProducts() {
  const { products } = useServices();
  return useQuery({ queryKey: productKeys.all, queryFn: () => products.list() });
}

export function useProduct(id: string) {
  const { products } = useServices();
  return useQuery({ queryKey: productKeys.one(id), queryFn: () => products.get(id) });
}

export function useSaveProduct() {
  const { products } = useServices();
  const queryClient = useQueryClient();
  return useMutation<string, ProductError, { input: ProductSaveInput; id?: string }>({
    mutationFn: ({ input, id }) => products.save(input, id),
    // The list and the edited product must show the new values.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });
}
