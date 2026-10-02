/**
 * Browser entry point: mounts the app into <div id="root"> in index.html.
 *
 * WHY:  Vite starts here. Global styles (design tokens) load once, before any component.
 * WHEN: Once, when the page loads.
 * SECURITY: Fails loudly if #root is missing instead of rendering nothing silently.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/App";
import "@/styles/index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('index.html is missing <div id="root">');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
