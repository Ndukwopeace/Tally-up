# ADR 0001 — Milestone 1 foundation choices

**Status:** Proposed (part of the Milestone 1 pull request; accepted when the owner merges it)
**Date:** 2026-10-02

## Context

Milestone 1 sets up the project with the stack approved in ARCHITECTURE §2. While installing it, some library versions did not work together, and a few small technical choices were needed that the documents do not spell out. None of them change business behaviour.

## Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | **TypeScript 6.0**, not 7.0 | typescript-eslint (type-aware lint rules) supports TypeScript up to 6.0. |
| 2 | **ESLint 9**, not 10 | eslint-plugin-jsx-a11y (accessibility lint, UI-2) supports ESLint up to 9. |
| 3 | **Tailwind CSS 4** with tokens in CSS (`@theme` in `src/styles/index.css`) | Current major version; tokens become utilities (`bg-brand`) with no separate config file. |
| 4 | **System font stack**, no web font | One sans-serif family (UI_GUIDELINES §8) with zero download; keeps the JS/CSS budget and works offline. |
| 5 | **shadcn/ui components written by hand** in the shadcn pattern (cva + Tailwind), starting with Button | Only what is used is added (YAGNI). Radix-based shadcn components are added when a screen needs them (dialogs, menus). |
| 6 | **Code split per portal** (route `lazy` for each layout) | PERF-2. A distributor's phone does not download admin code. Initial JS: 115 KB of the 250 KB budget. |
| 7 | **App icons drawn by a script** (`scripts/generate-icons.mjs`) with Node's built-in zlib | No image package needed (W-3); icons match the SVG logo exactly. |
| 8 | **Temporary start page at `/`** linking to the three portals | Login arrives in Milestone 2; the owner still needs to open each portal frame and install the app. Deleted in Milestone 2. |
| 9 | **`src/pwa/` folder** for install/update prompts | Not listed in ARCHITECTURE §3.2; keeps PWA code in one place. |
| 10 | **Zod and react-hook-form not installed yet** | Approved (T-1), but nothing uses them in Milestone 1. Added in Milestone 2 with the first form. |
| 11 | **Strict Content-Security-Policy** (`script-src 'self'`, no inline scripts) | SEC-10. The service worker is registered from bundled code, not an injected inline script. Side effect: Vercel's preview toolbar script is blocked on preview links; the app itself is unaffected. |
| 12 | **Import ordering is not lint-enforced** | ENGINEERING §6 asks for it, but it needs `eslint-plugin-import` (or similar), which is not on the approved list (W-3). Prettier keeps formatting consistent meanwhile. Needs an owner decision to add. |

## Consequences

- Upgrading to TypeScript 7 / ESLint 10 waits until the lint plugins support them; Dependabot or a `chore/` PR will surface that.
- Decision 12 is open until the owner approves or declines an import-order plugin.
