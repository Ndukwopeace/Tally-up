/**
 * Runs before every test file.
 *
 * WHY:  Adds DOM assertions (toBeInTheDocument, toHaveAccessibleName, ...) and
 *       removes rendered components between tests so tests never affect each other.
 * WHEN: Loaded by Vitest through `test.setupFiles` in vite.config.ts.
 */
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount everything rendered by the previous test.
afterEach(() => {
  cleanup();
});
