/**
 * The application root: providers around the router.
 *
 * WHY:  Keeps main.tsx to mounting only and gives tests one component to render.
 * HOW:  `startAuth` builds the one AuthStore for this page load from the build's
 *       configuration and starts checking the saved session. `App` renders the
 *       router inside the query and auth providers, or the "not connected"
 *       page when the build has no backend settings.
 * WHEN: `startAuth` and `App` are called once by main.tsx.
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
import { createAuthService } from "@/services";

/** Creates and starts the auth store, or returns null when the build has no backend settings. */
export function startAuth(config: AppConfig): AuthStore | null {
  if (!config.ok) {
    return null;
  }
  const store = new AuthStore(createAuthService(config));
  void store.start();
  return store;
}

export function App({ auth }: Readonly<{ auth: AuthStore | null }>) {
  // Created once per page load; re-creating it would reset navigation history.
  const [router] = useState(createAppRouter);
  if (!auth) {
    return <NotConnectedPage />;
  }
  return (
    <Providers>
      <AuthProvider store={auth}>
        <RouterProvider router={router} />
      </AuthProvider>
    </Providers>
  );
}
