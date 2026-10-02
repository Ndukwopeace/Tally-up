/**
 * Build, dev-server, PWA and test configuration for Tally-Up.
 *
 * WHY:  One file defines how the app is bundled (Vite), styled (Tailwind),
 *       made installable (vite-plugin-pwa) and tested (Vitest), so all four
 *       agree on paths and settings (ARCHITECTURE §2, §11, §16).
 * HOW:  Vite reads this file for `npm run dev` / `npm run build`; Vitest reads
 *       the `test` block for `npm test`.
 * WHEN: Every local run, every CI job and every Vercel build.
 * SECURITY: The service worker caches only the app shell (code, styles, icons).
 *       It never caches API responses, so no business data is stored on the
 *       phone and nothing is shown as saved unless the server confirmed it
 *       (NFR-06, ARCHITECTURE §11).
 */
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// Colour of the phone's status bar for the installed app: white, matching the white
// header (--color-surface), so the bar and header read as one strip.
const THEME_COLOR = "#ffffff";
// Page background shown on the PWA splash screen; matches --color-canvas.
const BACKGROUND_COLOR = "#f1f5f9";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt": a new version waits until the user taps Reload, so a form
      // being filled in is never wiped by an automatic refresh (S7: keep users in control).
      registerType: "prompt",
      // Registration is done in our own code (src/pwa/UpdatePrompt.tsx) rather
      // than an injected inline <script>.
      // SECURITY: no inline scripts lets the Content-Security-Policy forbid them (vercel.json).
      injectRegister: false,
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Tally-Up",
        short_name: "Tally-Up",
        description: "Bakery distribution tracking: collections, depot hand-overs and depot confirmations.",
        lang: "en",
        // Role-based start pages arrive with login in Milestone 2; until then "/" is the entry.
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          // Maskable: Android may crop the icon to a circle or squircle; the artwork sits in the safe zone.
          { src: "maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // App shell only (ARCHITECTURE §11). Data requests are never matched, so they always go to the network.
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        // Any in-app address opened offline still loads the shell, which then shows the "No connection" banner.
        navigateFallback: "/index.html",
        // SECURITY: server endpoints (Vercel Functions, Milestone 2) must never be answered from cache.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    // `@/x` means `src/x` (ENGINEERING §6).
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    // The PWA plugin's virtual module only exists inside a Vite build; tests use a stand-in.
    alias: {
      "virtual:pwa-register/react": fileURLToPath(
        new URL("./tests/mocks/pwa-register-react.ts", import.meta.url),
      ),
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // main.tsx only mounts <App /> into the page; it is exercised by the build, not unit tests.
      exclude: ["src/main.tsx", "src/**/*.test.{ts,tsx}"],
      reporter: ["text", "html"],
      // RULE ENG-5: coverage floors. A drop below any of these fails `npm run test:coverage` and CI.
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        "src/domain/**": { lines: 100, functions: 100, branches: 100, statements: 100 },
        "src/services/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
        "src/auth/**": { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});
