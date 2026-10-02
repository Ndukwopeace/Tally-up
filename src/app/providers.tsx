/**
 * App-wide providers.
 *
 * WHY:  ARCHITECTURE §3.3: data from the backend lives in the TanStack Query
 *       cache and nowhere else. The provider must wrap the whole app.
 * HOW:  One QueryClient for the lifetime of the page. Failed reads retry once,
 *       then show the ErrorState; nothing retries writes automatically.
 * WHEN: Wraps <App/> in main.tsx. Queries start being used in Milestone 2.
 * SECURITY: Writes are never retried silently, so a request that may have
 *       reached the server is not sent twice (COL-09). The cache holds data
 *       in memory only; it is never persisted to the phone (NFR-06).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  // useState keeps one client per page load, even if React re-renders this component.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: true },
          mutations: { retry: false },
        },
      }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
