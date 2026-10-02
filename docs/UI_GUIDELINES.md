# Tally-Up — User Interface Rules

**Status:** v0.1 — APPROVED by owner 2026-10-02 (UI-1 to UI-6 accepted)
**Date:** 2026-10-02
**Depends on:** `docs/REQUIREMENTS.md` v0.3, `docs/ARCHITECTURE.md`, `docs/wireframes/`

Every screen built for Tally-Up follows these rules. Each principle is stated once, then turned into concrete rules for this app. A rule that cannot be checked is not written here.

Note on "12 heuristics": Jakob Nielsen's usability heuristics number **10**. They are all in Section 2. Ben Shneiderman's **8 Golden Rules** are in Section 2 too, since they cover the same ground from another angle.

---

## 0. Who We Design For

User-centred design starts with the people, the place, and the device.

| User | Where | Device | Hands / attention | What they need fast |
|---|---|---|---|---|
| Distributor | Bakery yard, roadside, depot door. Outdoors, often bright sun. | Mid- to low-end Android phone | One hand free, the other carrying crates. Interrupted often. | Record what was loaded. Split it across depots. See what is left. |
| Depot Manager | Depot floor, counting crates | Android phone | Counting by hand, entering numbers between counts | See what's arriving. Enter real counts. Confirm. |
| Admin / Owner | Office or home | Laptop; sometimes phone | Full attention, reading and comparing | Today's picture, discrepancies, reports. |

Context constraints that drive the rules below:
- **Sunlight** → high contrast, no pale-on-pale text.
- **Interruptions** → every flow survives a pause; current step always visible.
- **One hand** → primary actions in the lower third of the screen.
- **Mobile data in Douala can drop** → clear online/offline state; no fake success.
- **Numbers are the product** → numbers are the largest text on operational screens.

User-centred process for this project:
1. Requirements and wireframes reviewed by the owner (done / in progress).
2. Each milestone is shown to the owner before the next one starts.
3. [PROPOSED] Before Milestone 7 go-live: one real distributor and one real depot manager complete the spec's Section 57 workflow on their own phones while we watch. Problems found become fixes, not notes.

---

## 1. Interaction Laws

### 1.1 Hick's Law — more choices, slower decisions

| Rule | Tally-Up application |
|---|---|
| H-1 | One primary action per screen. Distributor home: **New Collection**. Depot home: **Review receipt**. |
| H-2 | Bottom navigation has at most 5 items (Admin 4, Distributor 4, Depot 4; Q-46, Q-47). |
| H-3 | Pickers show only valid options: active depots only; only units the product supports; only the distributor's In Progress collections. |
| H-4 | Flows are split into short steps (Select → Quantities → Review → Submit) instead of one long form. |
| H-5 | Admin filters start collapsed to the 3 most used (date, depot, status); the rest sit behind "More filters". |

### 1.2 Fitts's Law — big and near is fast

| Rule | Tally-Up application |
|---|---|
| F-1 | Touch targets at least **48 × 48 px** on mobile (WCAG minimum is 24 px; we choose 48). |
| F-2 | Primary action is a full-width button fixed at the bottom of the screen, above the nav, in thumb reach. |
| F-3 | At least 8 px between separate touch targets. |
| F-4 | Quantity fields are large (min 56 px tall, 24 px numbers). Tapping anywhere on the row focuses the field. |
| F-5 | −/+ steppers are optional helpers beside a typeable number, never the only way to enter quantities in the hundreds. |
| F-6 | Destructive or final actions (Confirm Receipt, Submit Distribution) are not placed next to Back/Cancel without spacing. |

### 1.3 Jakob's Law — users expect your app to work like the apps they already use

| Rule | Application |
|---|---|
| J-1 | Back arrow top-left; notifications bell top-right; bottom tab bar on mobile; sidebar on desktop. |
| J-2 | Standard Android numeric keypad (`inputmode="numeric"`). No custom keypad. |
| J-3 | Pull-to-refresh on mobile lists. |

### 1.4 Miller's Law — people hold about 7 items in short-term memory

| Rule | Application |
|---|---|
| M-1 | The review screen repeats everything the user entered. They never have to remember earlier steps. |
| M-2 | Long numbers are grouped: 1,500 not 1500. IDs are short: `COL-00003`. |
| M-3 | Dashboards show at most 6 KPI cards (matches ADM-01). |

### 1.5 Tesler's Law — complexity cannot vanish; the system should carry it

| Rule | Application |
|---|---|
| T-1 | The system does the conversions, balances, differences and statuses. Users enter only what they saw or did. |
| T-2 | Users never type dates or times for transactions (COL-06). |
| T-3 | The app shows "Only 4 Packs (43 Loaves) available" instead of making the user calculate. |

### 1.6 Doherty Threshold — responses under 400 ms keep people engaged

| Rule | Application |
|---|---|
| D-1 | Every tap gives visible feedback within 100 ms (pressed state, spinner on the button). |
| D-2 | Pages show a skeleton immediately; content within 1 s on a 4G phone. |
| D-3 | Live calculations (remaining, difference) update on every keystroke, no "calculate" button. |

### 1.7 Postel's Law — be liberal in what you accept, strict in what you send

| Rule | Application |
|---|---|
| P-1 | Quantity input ignores spaces and thousands separators ("1 500", "1,500" → 1500). |
| P-2 | Email login is case-insensitive and trimmed. |
| P-3 | What is saved is always a clean whole number. Anything that cannot be cleaned is rejected with a clear message. |

### 1.8 Other laws applied

| Law | Rule |
|---|---|
| **Goal-Gradient** — people speed up near the end | Step indicator ("Step 2 of 3"); progress bar on collections ("550 of 800 Loaves distributed"). |
| **Zeigarnik** — unfinished tasks stay in mind | In Progress collections and pending receipts sit at the top of the home screens until done. |
| **Peak-End** — people judge by the peak and the end | Every flow ends on a clear result screen saying exactly what was recorded. |
| **Serial Position** — first and last items are remembered | Most used nav items at the ends: Home first, Profile last. |
| **Von Restorff** — the different item is noticed | Discrepancies are the only thing using the red/danger colour on dashboards. |
| **Aesthetic-Usability** — tidy looks are trusted | Consistent spacing, alignment, and type scale. No decoration that slows tasks (spec §43). |
| **Occam's Razor / KISS** | If a screen element does not help answer the core question, it is removed. |
| **Parkinson's Law** — tasks fill the time given | Sensible defaults: today's date in filters, the last used collection pre-selected for distribution. |

---

## 2. Usability Heuristics

### 2.1 Nielsen's 10 Usability Heuristics

| # | Heuristic | Tally-Up rules |
|---|---|---|
| N1 | **Visibility of system status** | Status badge on every collection and receipt. Remaining always visible while distributing. Online/offline banner. Button shows "Saving…" while pending. Unsynchronised data is never shown as saved (NFR-06). |
| N2 | **Match between system and the real world** | Use the bakery's words: Loaves, Packs, Caisse, Depot, Collection. Say "Hand over" or "Distribute" consistently (one term chosen per screen family). Dates like "Today, 9:42 AM". |
| N3 | **User control and freedom** | Back works on every step without losing entries within the flow. Remove a product row before submit. After submit, no undo by design (COL-10) — so the review step is mandatory. |
| N4 | **Consistency and standards** | One `StatusBadge`, one `QuantityInput`, one button style per role (primary, secondary, danger). Same label for the same thing everywhere (see wireframe review W-A3). |
| N5 | **Error prevention** | Over-distribution blocked before submit. Unit pickers show only valid units. Submit disabled until required fields are valid. Final actions go through review. |
| N6 | **Recognition rather than recall** | Product names with images/icons in pickers. Review screens list everything. Distributor recorded quantity shown next to the manager's count field (but not copied into it). |
| N7 | **Flexibility and efficiency of use** | Admin: keyboard navigation in tables, filters kept in the URL. Mobile: numeric keypad opens automatically; "Next" on keypad moves to the next quantity. |
| N8 | **Aesthetic and minimalist design** | Numbers, status, products, depots, actions first (spec §43). No charts on mobile operational screens. |
| N9 | **Help users recognise, diagnose and recover from errors** | Messages say what happened and what to do: "Only 4 Packs (43 Loaves) are available." Not "Error 422". Form keeps the user's input after an error. |
| N10 | **Help and documentation** | Short helper text under fields where needed (e.g. "Count what you physically received."). No separate help centre in v1. |

### 2.2 Shneiderman's 8 Golden Rules

| # | Rule | Tally-Up application |
|---|---|---|
| S1 | Strive for consistency | See N4. |
| S2 | Seek universal usability | Works on small, old phones and large desktops; accessible per Section 5. |
| S3 | Offer informative feedback | Every action ends in visible confirmation (toast or result screen). |
| S4 | Design dialogs to yield closure | Each flow ends on a result screen with clear next steps. |
| S5 | Prevent errors | See N5. |
| S6 | Permit easy reversal of actions | Allowed within a flow until Submit. After submit, reversal is an Admin correction with a trail — intentionally not easy. |
| S7 | Keep users in control | No auto-submit. No automatic navigation away while the user is typing. |
| S8 | Reduce short-term memory load | See M-1, N6. |

---

## 3. Don Norman's Design Principles

| Principle | Rule |
|---|---|
| **Affordance / Signifiers** | Buttons look like buttons (filled or outlined, never plain text for primary actions). Editable fields have a visible border. Read-only values have none. |
| **Mapping** | The manager's count field sits directly beside the distributor's recorded number for the same product. |
| **Feedback** | See N1, D-1. |
| **Constraints** | Units limited to the product's units. Quantities limited to whole numbers. Submit blocked when invalid. |
| **Conceptual model** | The app always shows the chain Collection → Distribution → Receipt with matching IDs, so users understand where a number came from. |

---

## 4. Gestalt Principles (layout)

| Principle | Rule |
|---|---|
| Proximity | Product name, unit, and quantity of one line are grouped tightly; lines are separated by more space than items within a line. |
| Similarity | Same status = same colour and shape everywhere. |
| Common region | Each product line, receipt, or collection is a card with a clear edge. |
| Figure / ground | The primary action button is the strongest colour on the screen. |
| Continuity | Step indicators and timelines read left-to-right / top-to-bottom. |

---

## 5. Accessibility — WCAG 2.2 Level AA

Target: **WCAG 2.2 AA** on every screen. The points below are the ones that matter most for this app.

### 5.1 Perceivable

| WCAG | Rule |
|---|---|
| 1.1.1 Non-text content | Icons that act as buttons have text labels or `aria-label`. Product images have alt text (product name). Charts have a text/table alternative. |
| 1.3.1 Info and relationships | Real `<table>` for tables, `<label>` for every input, headings in order (h1 → h2 → h3). |
| 1.3.4 Orientation | Works in portrait and landscape. |
| 1.3.5 Identify input purpose | `autocomplete="email"`, `autocomplete="current-password"` on login. |
| 1.4.1 Use of colour | Status is never colour alone: badge always has text and an icon (✓, ⚠, ⏳). |
| 1.4.3 Contrast (minimum) | Text ≥ **4.5 : 1**; large text (≥ 24 px, or 19 px bold) ≥ 3 : 1. Applies to text on pastel badges. |
| 1.4.4 Resize text | Usable at 200 % zoom. |
| 1.4.10 Reflow | No horizontal scrolling at 320 px width (except data tables on admin, which become cards on mobile). |
| 1.4.11 Non-text contrast | Input borders, focus rings, icons ≥ 3 : 1. |
| 1.4.12 Text spacing | Layout does not break if users increase line/letter spacing. |

### 5.2 Operable

| WCAG | Rule |
|---|---|
| 2.1.1 Keyboard | Everything works with a keyboard (admin especially). No keyboard traps in dialogs. |
| 2.4.3 Focus order | Focus follows visual order. Dialogs trap and return focus correctly. |
| 2.4.6 Headings and labels | Each page has one clear `h1` naming it. |
| 2.4.7 Focus visible | Visible focus ring on every interactive element. |
| 2.4.11 Focus not obscured (2.2) | Sticky bottom buttons and nav never cover the focused field; the page scrolls it into view. |
| 2.5.3 Label in name | Visible button text matches its accessible name. |
| 2.5.7 Dragging movements (2.2) | No drag-only interactions. |
| 2.5.8 Target size (2.2) | Minimum 24 × 24 px (we use 48 × 48 px, rule F-1). |

### 5.3 Understandable

| WCAG | Rule |
|---|---|
| 3.1.1 Language of page | `<html lang="en">`. |
| 3.2.2 On input | Choosing a depot or unit does not navigate away by itself. |
| 3.3.1 Error identification | Errors described in text, linked to the field. |
| 3.3.2 Labels or instructions | Every field has a visible label (placeholders are not labels). |
| 3.3.4 Error prevention (legal, financial, data) | Final submits are reviewable before commit (review screens). |
| 3.3.7 Redundant entry (2.2) | Information already entered in a flow is not asked for again. |
| 3.3.8 Accessible authentication (2.2) | Login allows password managers and paste; no puzzles. |

### 5.4 Robust

| WCAG | Rule |
|---|---|
| 4.1.2 Name, role, value | Use native elements or shadcn/ui (Radix) components with correct ARIA. |
| 4.1.3 Status messages | Toasts and "Saving…" announced via `aria-live`. |

### 5.5 Checking

- Automated: axe-core checks in Playwright tests on every page.
- Manual per milestone: keyboard-only pass on admin; TalkBack pass on one Android phone for distributor and depot flows; contrast check on all status badges.

---

## 6. Mobile Rules (Distributor & Depot Manager)

| # | Rule |
|---|---|
| MB-1 | Design at **360 px** wide first; test at 320 px. |
| MB-2 | Thumb zone: primary action fixed at the bottom; nothing critical in the top corners except Back and the bell. |
| MB-3 | Cards, not tables (spec §44). |
| MB-4 | Quantity entry: `inputmode="numeric"`, large numbers, unit shown inside the field ("200 Loaves"). |
| MB-5 | Keyboard never hides the field being typed into or the running total. |
| MB-6 | Every list has a search field once it can exceed 10 items. |
| MB-7 | Sticky summary while distributing: "Remaining after this: …". |
| MB-8 | Minimal typing: pickers for product, unit, depot. Free text only for the optional comment. |
| MB-9 | Works on a 3-year-old mid-range Android phone over 3G. Page JS budget: initial load ≤ 250 KB gzipped [PROPOSED]. |

## 7. Admin Rules (Desktop-first)

| # | Rule |
|---|---|
| AD-1 | Admin is phone-first for now (Q-48); the desktop layout (sidebar, header with page title and date) is designed later. |
| AD-2 | Tables: sortable columns, sticky header, right-aligned numbers, pagination at 25 rows. |
| AD-3 | Every number on a summary links to the records behind it. |
| AD-4 | Charts only when they answer an operational question; always with a table alternative. Never mix units in one chart (wireframe review W-A1). |
| AD-5 | Admin uses the 4 bottom tabs of Q-47 at every width until the desktop layout exists. |

---

## 8. Visual Language

Taken from the wireframes' direction; exact values set in Milestone 1 as design tokens.

| Element | Rule |
|---|---|
| Colour roles | Primary (blue, actions) · Success (green, Confirmed / Fully Distributed) · Warning (amber, Awaiting / In Progress) · Danger (red, Discrepancy only) · Neutral (greys) · Accent (orange, **logo only**, Q-45). |
| Status mapping | In Progress = amber · Fully Distributed = green · Awaiting Confirmation = amber · Confirmed = green · Confirmed with Discrepancy = red. Each also has its own icon and text. |
| Typography | One sans-serif family. Numbers use tabular figures so columns line up. Scale: 12 / 14 / 16 / 20 / 24 / 32 px. Body text minimum 16 px on mobile. |
| Spacing | 4 px grid (4, 8, 12, 16, 24, 32). |
| Corners & shadows | One radius for cards, one for buttons. Light shadows only. |
| Icons | Lucide, one stroke weight. Icon + text for anything important. |
| Dark mode | Not in v1 [PROPOSED]. Outdoor readability favours light mode. |

---

## 9. Content and Wording

| # | Rule |
|---|---|
| C-1 | Plain English, short sentences. Write like a supervisor talking, not a system. |
| C-2 | Buttons say what happens: "Submit Distribution", "Confirm Receipt" — not "OK", "Submit". |
| C-3 | Numbers always carry their unit: "200 Loaves", never "200". |
| C-4 | Error messages: what happened + what to do. No codes, no blame. |
| C-5 | Empty states use the spec's wording and offer the next action when one exists. |
| C-6 | All text lives in `src/i18n/en.ts` (NFR-12). |

---

## 10. States Every Screen Must Have

| State | Rule |
|---|---|
| Loading | Skeleton shaped like the content. |
| Empty | Message + next action. |
| Error | Plain message + "Try again". Input kept. |
| Offline | Banner; submits disabled with reason. |
| Success | Result screen (flows) or toast (edits). |
| Partial / pending | "Saving…" on the button; nothing shown as saved until confirmed. |

---

## 11. Screen Review Checklist

Every screen is checked against this list before it is handed over.

- [ ] One clear primary action, in thumb reach on mobile (H-1, F-2)
- [ ] Touch targets ≥ 48 px, spacing ≥ 8 px (F-1, F-3)
- [ ] Only valid options shown in pickers (H-3)
- [ ] Every number has its unit; no mixed-unit totals (C-3, W-A1)
- [ ] Status shown with text + icon + colour (1.4.1)
- [ ] Contrast passes 4.5 : 1 for text, 3 : 1 for UI (1.4.3, 1.4.11)
- [ ] Every input has a visible label (3.3.2)
- [ ] Loading, empty, error, offline, success states present (Section 10)
- [ ] Review step before any final submit (N5, 3.3.4)
- [ ] Works at 320 px wide and at 200 % zoom (1.4.10, 1.4.4)
- [ ] Keyboard and screen reader pass (2.1.1, 4.1.2)
- [ ] axe-core finds no violations
- [ ] Nothing on screen that the requirements do not define

---

## 12. Decisions (all accepted by owner 2026-10-02)

| # | Question | Decision |
|---|---|---|
| UI-1 | Minimum touch target | 48 × 48 px |
| UI-2 | Accessibility target | WCAG 2.2 AA |
| UI-3 | Real-user test before go-live (one distributor, one depot manager) | Yes |
| UI-4 | Dark mode in v1 | No |
| UI-5 | Initial JS budget | ≤ 250 KB gzipped |
| UI-6 | Wireframe decisions WD-1 … WD-5 | Decided — see `docs/wireframes/README.md` |
