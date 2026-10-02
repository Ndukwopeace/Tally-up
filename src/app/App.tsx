/**
 * The application root: providers around the router.
 *
 * WHY:  Keeps main.tsx to mounting only and gives tests one component to render.
 * HOW:  `startApp` builds the backend services for this page load from the
 *       build's configuration, plus the AuthStore, and starts checking the
 *       saved session. `App` renders the router inside the query, services and
 *       auth providers, or the "not connected" page when the build has no
 *       backend settings.
 * WHEN: `startApp` and `App` are called once by main.tsx.
 * SECURITY: See router.tsx for route protection and config/env.ts for which
 *       backend may be used.
 */
import { useState } from "react";
import { RouterProvider } from "react-router";

import { Providers } from "./providers";
import { createAppRouter } from "./router";

import { AuthProvider } from "@/auth/AuthProvider";
import { AuthStore } from "@/auth/AuthStore";
import type { AppConfig } from "@/config/env";
import { NotConnectedPage } from "@/pages/NotConnectedPage";
import { createServices, type Services } from "@/services";
import { ServicesProvider } from "@/services/ServicesProvider";

/** Everything the app needs at start-up. */
export interface AppStart {
  auth: AuthStore;
  services: Services;
}

/** Creates the services and auth store, or returns null when the build has no backend settings. */
export function startApp(config: AppConfig): AppStart | null {
  if (!config.ok) {
    return null;
  }
  const services = createServices(config);
  const auth = new AuthStore(services.auth);
  void auth.start();
  return { auth, services };
}

export function App({ start }: Readonly<{ start: AppStart | null }>) {
  // Created once per page load; re-creating it would reset navigation history.
  const [router] = useState(createAppRouter);
  if (!start) {
    return <NotConnectedPage />;
  }
  return (
    <Providers>
      <ServicesProvider services={start.services}>
        <AuthProvider store={start.auth}>
          <RouterProvider router={router} />
        </AuthProvider>
      </ServicesProvider>
    </Providers>
  );
}
