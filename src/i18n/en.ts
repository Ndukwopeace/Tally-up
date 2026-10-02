/**
 * Every piece of text the user sees, in English.
 *
 * WHY:  NFR-12 / C-6: English only for now, but all text in one place so French
 *       can be added later without hunting through components. One place also
 *       keeps labels identical everywhere (N4, consistency).
 * HOW:  A nested, read-only object. Components read `en.section.key`.
 *       Wording follows UI_GUIDELINES §9: plain English, buttons say what happens,
 *       numbers always carry a unit.
 * WHEN: Imported by every component that shows text.
 * SECURITY: Static strings only. Never build HTML from these; React escapes them.
 */
import type { Status } from "@/types/enums";

export const en = {
  app: {
    name: "Tally-Up",
    skipToContent: "Skip to main content",
  },

  // REQUIREMENTS §8 + wireframe review W-A3: these five labels and no others.
  status: {
    in_progress: "In Progress",
    fully_distributed: "Fully Distributed",
    awaiting_confirmation: "Awaiting Confirmation",
    confirmed: "Confirmed",
    confirmed_with_discrepancy: "Confirmed with Discrepancy",
  } satisfies Record<Status, string>,

  nav: {
    mainLabel: "Main navigation",
    dashboard: "Dashboard",
    collections: "Collections",
    distributions: "Distributions",
    receipts: "Receipts",
    history: "History",
    profile: "Profile",
    notifications: "Notifications",
    adminPending: "Admin navigation is decided before Milestone 3 (NAV-1).",
  },

  // Messages for QuantityInput, one per QuantityError (domain/quantity.ts).
  quantity: {
    empty: "Enter a quantity.",
    not_whole_number: "Use whole numbers only, like 200 or 1,500.",
    negative: "Quantities cannot be negative.",
    too_large: "That number is too large.",
  },

  actions: {
    saving: "Saving…",
    tryAgain: "Try again",
    reload: "Reload",
    install: "Install app",
    notNow: "Not now",
  },

  states: {
    loading: "Loading…",
    errorTitle: "Something went wrong",
    errorDefault: "We could not load this. Check your connection and try again.",
    offline: "No connection. You can look around, but saving is off until you are back online.",
  },

  pwa: {
    updateAvailable: "A new version of Tally-Up is available.",
    installTitle: "Install Tally-Up on this phone",
    installBody: "Open it from your home screen like any other app.",
  },

  placeholder: {
    comingIn: (milestone: number) => `This screen is built in Milestone ${milestone}.`,
  },

  pages: {
    adminDashboard: "Admin Dashboard",
    distributorDashboard: "Distributor Dashboard",
    depotDashboard: "Depot Dashboard",
    notFoundTitle: "Page not found",
    notFoundBody: "This address does not exist in Tally-Up.",
    notFoundAction: "Go to the start page",
  },

  // Temporary start page for Milestone 1 only; replaced by /login in Milestone 2.
  preview: {
    title: "Tally-Up preview",
    intro: "Milestone 1: the app frame for each role. Real screens arrive in later milestones.",
    adminLink: "Open the Admin portal",
    distributorLink: "Open the Distributor portal",
    depotLink: "Open the Depot Manager portal",
  },
} as const;
