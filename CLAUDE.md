# CLAUDE.md — Rules for AI sessions on Tally-Up

Read this file and the documents below **before any task**. They override your defaults.

## Documents (source of truth)

| File | What it decides |
|---|---|
| `docs/REQUIREMENTS.md` | What the system does. Decision log in §12. |
| `docs/ARCHITECTURE.md` | How it is built. |
| `docs/UI_GUIDELINES.md` | UI rules and screen checklist. |
| `docs/ENGINEERING.md` | Coding, comments, testing, git, security, review. |
| `docs/wireframes/README.md` | Visual direction and wireframe corrections. Requirements win over wireframes. |

## Hard rules

1. Build only what the documents define. Out-of-scope list: `docs/REQUIREMENTS.md` §2.
2. Never assume a business rule. If something is missing or conflicting, stop and ask the owner.
3. No new npm package without owner approval.
4. Never change an approved document without an owner decision recorded in its decision log.
5. Never force push, rewrite history, delete branches or repositories, or change repository settings.
6. Work only on the branch you were assigned. One task per pull request.
7. Tests first (red → green → refactor). Never skip, disable, or delete a test to get green.
8. Comment code per `docs/ENGINEERING.md` §2: why, how, when, security. `// SECURITY:` and `// RULE <ID>:` lines are mandatory where they apply.
9. Never put secrets in code or commits. The Supabase service-role key exists only in Vercel Functions.
10. Stop at the end of each phase and wait for owner sign-off.
11. Report results honestly, including failures and skipped steps.
12. Write to the owner in plain, direct language. No filler.
