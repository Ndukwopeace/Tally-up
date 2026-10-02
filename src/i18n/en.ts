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
    home: "Home",
    dashboard: "Dashboard",
    collections: "Collections",
    distributions: "Distributions",
    more: "More",
    depots: "Depots",
    products: "Products",
    users: "Users",
    reports: "Reports",
    receipts: "Receipts",
    history: "History",
    profile: "Profile",
    profileAccount: "Profile / My Account",
    notifications: "Notifications",
    back: "Back",
    account: "Account",
    signOut: "Sign Out",
    // Accessible name of the header logo link; the visible logo reads "Tally-Up".
    logoHome: (destination: string) => `Tally-Up, go to ${destination}`,
  },

  // One line under each item on the admin More page (Q-47), from REQUIREMENTS §5.2–5.4, §5.11.
  more: {
    depots: "Depot locations and their managers",
    products: "Bread products, units and loaves per unit",
    users: "Distributors, depot managers and admins",
    reports: "Filtered reports and PDF export",
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
    installIos: "Tap the Share button, then “Add to Home Screen”.",
  },

  // Shown on screens that are not built yet. Plain words only: no milestone numbers or codes.
  placeholder: {
    title: "Coming soon",
    body: "This screen is not built yet.",
  },

  pages: {
    notFoundTitle: "Page not found",
    notFoundBody: "This address does not exist in Tally-Up.",
    notFoundAction: "Go to the start page",
  },

  // Temporary start page until login exists (Milestone 2).
  preview: {
    title: "Choose a portal",
    intro: "Preview build. Login comes next; for now, open any portal to look around.",
    admin: "Admin",
    adminHint: "Owner and management",
    distributor: "Distributor",
    distributorHint: "Collections and hand-overs to depots",
    depot: "Depot Manager",
    depotHint: "Receipts and physical counts",
  },
} as const;
