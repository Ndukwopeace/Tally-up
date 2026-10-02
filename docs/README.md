# Tally-Up Documentation

| Document | Purpose | Status |
|---|---|---|
| [REQUIREMENTS.md](REQUIREMENTS.md) | What the system does, decision log, delivery plan | v0.5 — Q-55, Q-56 recorded; open item SMTP-1 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Frontend, auth, backend, routes, security, deployment | v0.2 — approved; A-5 to A-10 proposed in A1 |
| [UI_GUIDELINES.md](UI_GUIDELINES.md) | UI laws, heuristics, WCAG 2.2 AA, mobile/admin rules, screen checklist | v0.1 — approved |
| [ENGINEERING.md](ENGINEERING.md) | Comments, GitHub Flow, clean code, TDD, CI, security, versioning | v0.1 — approved |
| [SETUP.md](SETUP.md) | Owner steps in Supabase and Vercel (migrations, first admin, redirect URLs) | A1 |
| [TRACEABILITY.md](TRACEABILITY.md) | Requirement → test → code map | Updated every feature PR |
| [adr/](adr/) | Architecture Decision Records | One per significant technical decision |
| [wireframes/](wireframes/README.md) | Proposed wireframes and their review against requirements | Visual direction accepted |
| [../CLAUDE.md](../CLAUDE.md) | Rules every AI session reads first | Active |

Order of authority when documents disagree: **REQUIREMENTS → ARCHITECTURE → UI_GUIDELINES → ENGINEERING → wireframes**. A disagreement is reported to the owner, not resolved silently.
