/**
 * Checks run on staged files before each commit (ENGINEERING §6, ENG-7).
 *
 * WHY:  Catch formatting, lint and type errors on the developer's machine,
 *       before CI, so broken code is never committed.
 * WHEN: Automatically, through the Husky pre-commit hook (.husky/pre-commit).
 */
export default {
  "*.{ts,tsx,js,mjs}": ["eslint --max-warnings=0 --fix", "prettier --write"],
  "*.{json,css,html,yml,yaml}": "prettier --write",
  // Type errors can be caused by a change in another file, so the whole project is checked.
  "*.{ts,tsx}": () => "tsc -b",
};
