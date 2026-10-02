/**
 * TanStack Query hooks for user accounts (ARCHITECTURE §3.3: server data lives in the query cache).
 *
 * WHY:  Pages get loading, error and success states (NFR-07), and a save
 *       shows up everywhere without a manual refresh.
 * HOW:  `useUsers` and `useUser` read through the UserService; `useSaveUser`
 *       creates or edits an account and marks every user query stale. Depots and
 *       their manager lists are refreshed too, because putting a manager in
 *       charge of a depot deactivates the one who ran it (Q-57c).
 *       `useResetPassword` sets a new temporary password (Q-57b).
 * WHEN: Users list and form (A2c).
 * SECURITY: Data comes only from the service; RLS filters it and the server checks the admin.
 *       Passwords pass through the mutation and are never kept in the cache.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { depotKeys } from "./useDepots";

import type { UserSaveInput } from "@/domain/users";
import type { UserError } from "@/services/interfaces/UserService";
import { useServices } from "@/services/ServicesProvider";

/** Query keys for users, in one place so saves can invalidate them. */
export const userKeys = {
  all: ["users"] as const,
  one: (id: string) => ["users", id] as const,
};

export function useUsers() {
  const { users } = useServices();
  return useQuery({ queryKey: userKeys.all, queryFn: () => users.list() });
}

export function useUser(id: string) {
  const { users } = useServices();
  return useQuery({ queryKey: userKeys.one(id), queryFn: () => users.get(id) });
}

/** Creates (`id` undefined, with `password`) or edits an account; resolves to its id. */
export function useSaveUser() {
  const { users } = useServices();
  const queryClient = useQueryClient();
  return useMutation<string, UserError, { input: UserSaveInput; id?: string; password?: string }>({
    mutationFn: ({ input, id, password }) =>
      id === undefined ? users.create(input, password ?? "") : users.update(id, input),
    onSuccess: async () => {
      // Accounts, and the depot list with its managers (Q-57c).
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: userKeys.all }),
        queryClient.invalidateQueries({ queryKey: depotKeys.all }),
      ]);
    },
  });
}

export function useResetPassword() {
  const { users } = useServices();
  return useMutation<unknown, UserError, { id: string; password: string }>({
    mutationFn: ({ id, password }) => users.resetPassword(id, password),
  });
}
