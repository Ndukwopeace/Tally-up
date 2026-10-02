/**
 * TanStack Query hooks for depots (ARCHITECTURE §3.3: server data lives in the query cache).
 *
 * WHY:  Pages get loading, error and success states (NFR-07), and a save
 *       shows up everywhere without a manual refresh.
 * HOW:  `useDepots`, `useDepot` and `useDepotManagers` read through the
 *       DepotService; `useSaveDepot` saves and marks every depot query stale.
 *       Manager queries are refreshed too, because assigning a manager can
 *       deactivate another (Q-57c).
 * WHEN: Depots list, detail and form (A2b); later the distributor's depot picker.
 * SECURITY: Data comes only from the service, which RLS filters.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { DepotSaveInput } from "@/domain/depots";
import type { DepotError } from "@/services/interfaces/DepotService";
import { useServices } from "@/services/ServicesProvider";

/** Query keys for depots, in one place so saves can invalidate them. */
export const depotKeys = {
  all: ["depots"] as const,
  one: (id: string) => ["depots", id] as const,
  managers: ["depots", "managers"] as const,
};

export function useDepots() {
  const { depots } = useServices();
  return useQuery({ queryKey: depotKeys.all, queryFn: () => depots.list() });
}

export function useDepot(id: string) {
  const { depots } = useServices();
  return useQuery({ queryKey: depotKeys.one(id), queryFn: () => depots.get(id) });
}

export function useDepotManagers() {
  const { depots } = useServices();
  return useQuery({ queryKey: depotKeys.managers, queryFn: () => depots.listManagers() });
}

export function useSaveDepot() {
  const { depots } = useServices();
  const queryClient = useQueryClient();
  return useMutation<string, DepotError, { input: DepotSaveInput; id?: string }>({
    mutationFn: ({ input, id }) => depots.save(input, id),
    // Lists, the edited depot and the manager list (a manager may have been deactivated).
    onSuccess: () => queryClient.invalidateQueries({ queryKey: depotKeys.all }),
  });
}
