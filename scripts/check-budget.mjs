/**
 * Fails the build if the JavaScript needed to open the app is too large.
 *
 * WHY:  RULE PERF-1 / UI-5: initial JavaScript ≤ 250 KB gzipped, so the app
 *       opens quickly on a 3-year-old Android phone over a slow connection (MB-9).
 * HOW:  Reads dist/index.html, finds the entry script and every module it
 *       preloads (the code needed before anything shows), gzips each file the way
 *       a server would, adds them up, prints a table, and exits with code 1 if
 *       the total is over budget. Code loaded later (other portals) is not counted.
 * WHEN: `npm run budget`, right after `npm run build`, locally and in the `build` CI job.
 * SECURITY: Reads build output only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_BYTES = 250 * 1024;
const DIST = "dist";

const html = readFileSync(join(DIST, "index.html"), "utf8");
// <script type="module" src="..."> and <link rel="modulepreload" href="..."> are loaded before first paint.
const files = [
  ...html.matchAll(/<script[^>]+type="module"[^>]+src="\/([^"]+)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/([^"]+)"/g),
].map((match) => match[1]);

if (files.length === 0) {
  process.stderr.write("Budget check: no entry script found in dist/index.html. Did the build run?\n");
  process.exit(1);
}

let total = 0;
for (const file of new Set(files)) {
  const size = gzipSync(readFileSync(join(DIST, file)), { level: 9 }).length;
  total += size;
  process.stdout.write(`${(size / 1024).toFixed(1).padStart(8)} KB  ${file}\n`);
}
process.stdout.write(`${(total / 1024).toFixed(1).padStart(8)} KB  total initial JS (gzip), budget 250 KB\n`);

if (total > BUDGET_BYTES) {
  process.stderr.write("Over budget (PERF-1). Split code or remove weight before merging.\n");
  process.exit(1);
}
