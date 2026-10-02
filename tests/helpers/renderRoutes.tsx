/**
 * Renders the real route table with a mock sign-in, for page and routing tests.
 *
 * WHY:  Since A1 every portal sits behind login (AUTH-08). Tests need to
 *       render a page "as" a given user without a network or Supabase.
 * HOW:  Builds a MockAuthService (signed in as `signedInAs`, if given), an
 *       AuthStore over it, mock product, depot and user services (or the ones passed), a fresh
 *       query cache, and a memory router at `path` with optional earlier
 *       `history` entries. `openPortals` defaults to every role so the
 *       distributor and depot frames can still be tested before their
 *       milestones; tests about Q-55 pass ["admin"].
 * WHEN: Imported by *.test.tsx files.
 * SECURITY: Test-only; uses fictional mock users.
 */
import { MOCK_PASSWORD } from "./mockPassword";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { routes } from "@/app/router";
import { AuthProvider } from "@/auth/AuthProvider";
import { AuthStore } from "@/auth/AuthStore";
import { MOCK_USERS, MockAuthService } from "@/services/mock/MockAuthService";
import { MockDepotService } from "@/services/mock/MockDepotService";
import { MockProductService } from "@/services/mock/MockProductService";
import { MockUserService } from "@/services/mock/MockUserService";
import { ServicesProvider } from "@/services/ServicesProvider";
import { ROLES, type Role } from "@/types/enums";

export interface RenderRoutesOptions {
  /** Earlier pages in the history stack, oldest first. */
  history?: string[];
  /** Mock user id to start signed in as; signed out when undefined. */
  signedInAs?: string;
  /** Portals open to sign-in. */
  openPortals?: readonly Role[];
  /** Use this service instead of a fresh mock (e.g. to fail or hold calls). */
  service?: MockAuthService;
  /** Use this product service instead of an empty mock. */
  products?: MockProductService;
  /** Use this depot service instead of an empty mock. */
  depots?: MockDepotService;
  /** Use this user service instead of an empty mock. */
  users?: MockUserService;
  /** Leave the store un-started, to see the "checking" state. */
  start?: boolean;
}

export function renderRoutes(path: string, options: RenderRoutesOptions = {}) {
  const service =
    options.service ?? new MockAuthService({ password: MOCK_PASSWORD, signedInAs: options.signedInAs });
  const store = new AuthStore(service, options.openPortals ?? ROLES);
  if (options.start !== false) {
    void store.start();
  }
  const products = options.products ?? new MockProductService();
  const depots = options.depots ?? new MockDepotService();
  const users = options.users ?? new MockUserService();
  // A fresh cache per test; no retries, so error states show at once.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries: [...(options.history ?? []), path] });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ServicesProvider services={{ auth: service, products, depots, users }}>
        <AuthProvider store={store}>
          <RouterProvider router={router} />
        </AuthProvider>
      </ServicesProvider>
    </QueryClientProvider>,
  );
  return { router, store, service, products, depots, users, view };
}

/** The mock user who owns a portal path, so portal tests are signed in as the right role. */
export function ownerOf(path: string): string {
  if (path.startsWith("/distributor")) {
    return MOCK_USERS.distributor.id;
  }
  if (path.startsWith("/depot")) {
    return MOCK_USERS.manager.id;
  }
  return MOCK_USERS.admin.id;
}
