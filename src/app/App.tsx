/**
 * The application root: providers around the router.
 *
 * WHY:  Keeps main.tsx to one line of mounting and gives tests one component to render.
 * HOW:  Creates the browser router once and renders it inside Providers.
 * WHEN: Rendered once by main.tsx.
 * SECURITY: None directly; see router.tsx for route protection.
 */
import { useState } from "react";
import { RouterProvider } from "react-router";

import { Providers } from "./providers";
import { createAppRouter } from "./router";

export function App() {
  // Created once per page load; re-creating it would reset navigation history.
  const [router] = useState(createAppRouter);
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
