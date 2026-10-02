/**
 * Makes the backend services available to hooks (ARCHITECTURE §3.1).
 *
 * WHY:  Hooks need the product service (and later others) without importing a
 *       concrete backend, so tests can hand in mocks.
 * HOW:  A React context holding the `Services` object; `useServices()` reads it.
 * WHEN: Wraps the router in App.tsx; tests wrap routes with mock services.
 * SECURITY: Holds no secrets; the Supabase client inside uses the public key only.
 */
import { createContext, use, type ReactNode } from "react";

import type { Services } from "./index";

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({
  services,
  children,
}: Readonly<{ services: Services; children: ReactNode }>) {
  return <ServicesContext value={services}>{children}</ServicesContext>;
}

/** The app's backend services. Must be used inside <ServicesProvider>. */
export function useServices(): Services {
  const services = use(ServicesContext);
  if (!services) {
    throw new Error("useServices must be used inside <ServicesProvider>.");
  }
  return services;
}
