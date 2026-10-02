/**
 * ESLint rules for Tally-Up (ENGINEERING §6).
 *
 * WHY:  Catches bugs, unsafe types and accessibility mistakes before review.
 * HOW:  Recommended JavaScript rules + strict type-aware TypeScript rules +
 *       React Hooks rules + strict jsx-a11y accessibility rules (WCAG 2.2 AA, UI-2).
 * WHEN: `npm run lint`, the pre-commit hook, and the `lint` CI job (zero warnings allowed).
 * SECURITY: `no-console` keeps debugging output (which can leak data) out of committed code.
 */
import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Generated or third-party output is never linted.
  { ignores: ["dist", "dev-dist", "coverage", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      // Type-aware rules read the real TypeScript project, so they see the same types as `tsc`.
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: globals.browser,
    },
  },
  reactHooks.configs.flat["recommended-latest"],
  jsxA11y.flatConfigs.strict,
  {
    rules: {
      // ENGINEERING §6: no console output in committed code.
      "no-console": "error",
      // Numbers in template strings (e.g. "Only ${n} Packs") are normal and safe.
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  // Plain JavaScript files (this config, Node scripts) are not part of a TypeScript project.
  { files: ["**/*.js", "**/*.mjs"], ...tseslint.configs.disableTypeChecked },
  {
    files: ["scripts/**", "api/**", "eslint.config.js", ".lintstagedrc.js"],
    languageOptions: { globals: globals.node },
  },
);
