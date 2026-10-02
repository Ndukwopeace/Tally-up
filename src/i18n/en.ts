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
import type { DepotFieldError } from "@/domain/depots";
import type { ProductFieldError } from "@/domain/products";
import type { AuthErrorCode } from "@/services/interfaces/AuthService";
import type { DepotErrorCode } from "@/services/interfaces/DepotService";
import type { ProductErrorCode } from "@/services/interfaces/ProductService";
import type { Role, Status } from "@/types/enums";

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
    audit: "Audit log",
    settings: "Settings",
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

  // One line under each item on the admin More page (Q-47, Q-51), from REQUIREMENTS §5.2–5.4, §5.11, §5.12, §11.
  more: {
    depots: "Depot locations and their managers",
    products: "Bread products, units and loaves per unit",
    users: "Distributors, depot managers and admins",
    reports: "Filtered reports and PDF export",
    audit: "Who did what, and when",
    settings: "Business rules: time zone, units, record numbers",
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

  // REQUIREMENTS §4: the three roles, as shown to people.
  roles: {
    admin: "Admin",
    distributor: "Distributor",
    depot_manager: "Depot Manager",
  } satisfies Record<Role, string>,

  // Login, forgot password, reset password (AUTH-01 to AUTH-09).
  auth: {
    signInTitle: "Sign in",
    signInIntro: "Use the email and password your administrator gave you.",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    forgotLink: "Forgot password?",
    or: "or",
    // AUTH-04 / AUTH-05: shown disabled until the owner adds the Google OAuth client.
    google: "Continue with Google",
    googleNotYet: "Not available yet",
    // One message per form check in domain/validation.ts.
    fieldErrors: {
      email_required: "Enter your email address.",
      email_invalid: "Enter an email address like name@example.com.",
      password_required: "Enter your password.",
      new_password_required: "Enter a new password.",
      passwords_differ: "The two passwords do not match.",
    },
    offline: "No connection.",
    startError: "We could not check your sign-in. Check your connection and try again.",
    forgotTitle: "Reset your password",
    forgotIntro: "Enter the email you sign in with. We will email you a link to choose a new password.",
    sendLink: "Send reset link",
    sending: "Sending…",
    // Same answer whether or not the account exists, so nobody can test which emails have accounts.
    linkSent: (email: string) =>
      `If ${email} has a Tally-Up account, a reset link is on its way. Check your inbox and spam folder.`,
    backToSignIn: "Back to sign in",
    resetTitle: "Choose a new password",
    newPassword: "New password",
    repeatPassword: "Repeat new password",
    savePassword: "Save new password",
    passwordSaved: "Your password has been changed.",
    continue: "Continue",
    linkExpiredTitle: "This link no longer works",
    linkExpiredBody: "Reset links work once and expire after a while. Ask for a new one.",
    askNewLink: "Ask for a new link",
    // One message per AuthErrorCode (ARCHITECTURE §13: codes become plain words here).
    errors: {
      invalid_credentials: "Wrong email or password.",
      no_account: "No Tally-Up account exists for this email. Contact your administrator.",
      inactive: "Your account is inactive. Contact your administrator.",
      portal_not_open: "Sign-in for your role is not open yet. Only admins can sign in for now.",
      rate_limited: "Too many attempts. Wait a few minutes and try again.",
      weak_password: "This password is too weak. Choose a longer one that is harder to guess.",
      same_password: "The new password must be different from your current one.",
      session_missing: "Your session has ended. Sign in again.",
      unavailable: "Tally-Up could not be reached. Check your connection and try again.",
    } satisfies Record<AuthErrorCode, string>,
  },

  // Shown on Sign Out while the session ends (Q-56: every action shows progress).
  signOut: {
    signingOut: "Signing out…",
  },

  // Profile / My Account (§7: name, email, role, change password, sign out).
  profile: {
    name: "Name",
    email: "Email",
    role: "Role",
    changePassword: "Change password",
  },

  // Active / Inactive for users, depots and products (REQUIREMENTS §8).
  recordStatus: {
    active: "Active",
    inactive: "Inactive",
  },

  // Unit names, singular and plural (PRD-03).
  units: {
    Loaf: { one: "Loaf", many: "Loaves" },
    Pack: { one: "Pack", many: "Packs" },
    Caisse: { one: "Caisse", many: "Caisses" },
  },

  // Products list and form (A2a: PRD-01 to PRD-05, Q-57).
  products: {
    add: "Add product",
    newTitle: "New product",
    editTitle: "Edit product",
    search: "Search by name or code",
    emptyTitle: "No products yet",
    emptyBody: "Add the breads your distributors collect.",
    noMatch: (query: string) => `No product matches "${query}".`,
    saved: (name: string) => `${name} was saved.`,
    name: "Name",
    code: "Code",
    codeHint: "Letters, numbers and dashes, up to 20. For example BB-01.",
    // RULE Q-57j: optional.
    description: "Description (optional)",
    unitsLegend: "Units",
    loafAlways: "Loaf: always available, 1 loaf",
    packOn: "Sold in Packs",
    packLoaves: "Loaves in one Pack",
    caisseOn: "Sold in Caisses",
    caisseMode: "Count one Caisse in",
    caisseCountLoaves: "Loaves in one Caisse",
    caisseCountPacks: "Packs in one Caisse",
    caisseTotal: (loaves: number) => `1 Caisse = ${loaves.toLocaleString("en")} loaves`,
    activeLabel: "Active",
    activeHint: "Inactive products cannot be added to new collections.",
    save: "Save product",
    notFoundTitle: "Product not found",
    notFoundBody: "This product does not exist, or the link is out of date.",
    backToList: "Go to products",
    // "Pack = 10 loaves" in the list.
    unitLine: (unit: string, loaves: number) => `${unit} = ${loaves.toLocaleString("en")} loaves`,
    fieldErrors: {
      name_required: "Enter the product name.",
      code_required: "Enter a product code.",
      code_invalid: "Use letters, numbers and dashes only, up to 20 characters.",
      loaves_required: "Enter how many.",
      loaves_min_one: "Must be at least 1.",
      caisse_needs_pack: "Switch on Packs and set loaves per Pack first, or count the Caisse in loaves.",
      too_large: "That number is too large.",
    } satisfies Record<ProductFieldError, string>,
    errors: {
      code_taken: "Another product already uses this code.",
      invalid: "Some values were refused. Check the form and try again.",
      not_found: "This product no longer exists.",
      not_admin: "Only an active admin can change products.",
      unavailable: "Tally-Up could not be reached. Check your connection and try again.",
    } satisfies Record<ProductErrorCode, string>,
  },

  // Phone number lists (Q-57i), used by depots and users.
  phones: {
    legend: "Phone numbers (optional)",
    hint: "Cameroon numbers, for example 6 77 12 34 56 or +237 2 33 44 55 66.",
    label: (position: number) => `Phone ${String(position)}`,
    add: "Add another number",
    remove: (position: number) => `Remove phone ${String(position)}`,
    invalid: "Enter a Cameroon number: 9 digits starting with 2 or 6, with or without +237.",
  },

  // Depots list, detail and form (A2b: DEP-01 to DEP-06, Q-57c, Q-57i).
  depots: {
    add: "Add depot",
    newTitle: "New depot",
    editTitle: "Edit depot",
    edit: "Edit depot",
    search: "Search by name or location",
    emptyTitle: "No depots yet",
    emptyBody: "Add the depots your distributors deliver to.",
    noMatch: (query: string) => `No depot matches "${query}".`,
    saved: (name: string) => `${name} was saved.`,
    name: "Name",
    location: "Location",
    address: "Address or description",
    manager: "Manager",
    noManager: "No manager yet",
    managerNone: "No manager",
    managerHint: "One manager per depot.",
    managerOption: (name: string, where: string) => `${name} (${where})`,
    managerRunsHere: "runs this depot",
    managerRunsOther: (depot: string) => `runs ${depot}`,
    managerFree: "no depot",
    managerInactive: "inactive",
    noManagersYet: "No depot manager accounts yet. Create them in Users.",
    // RULE Q-57c: say who will lose access before saving.
    replaceWarning: (name: string) => `${name} will be deactivated and will no longer run this depot.`,
    // RULE DEP-03: one depot per manager, so moving them leaves their old depot without one.
    moveWarning: (name: string, depot: string) => `${name} will move here. ${depot} will have no manager.`,
    activeLabel: "Active",
    activeHint: "Inactive depots are not offered to distributors.",
    save: "Save depot",
    phonesTitle: "Phone numbers",
    noPhones: "No phone number",
    historyTitle: "Distributions and receipts",
    historyEmpty:
      "The history of hand-overs to this depot will appear here once distributors start recording them.",
    notFoundTitle: "Depot not found",
    notFoundBody: "This depot does not exist, or the link is out of date.",
    backToList: "Go to depots",
    fieldErrors: {
      name_required: "Enter the depot name.",
      location_required: "Enter where the depot is, for example Douala.",
      address_required: "Enter the address or a short description.",
      phone_invalid: "Enter a Cameroon number: 9 digits starting with 2 or 6, with or without +237.",
    } satisfies Record<DepotFieldError, string>,
    errors: {
      invalid: "Some values were refused. Check the form and try again.",
      not_found: "This depot no longer exists.",
      not_a_manager: "That account is not a depot manager.",
      not_admin: "Only an active admin can change depots.",
      unavailable: "Tally-Up could not be reached. Check your connection and try again.",
    } satisfies Record<DepotErrorCode, string>,
  },

  // Shown when a build has no database settings (config/env.ts).
  config: {
    title: "Tally-Up is not connected",
    body: "This copy of the app has no database settings. Tell the person who manages Tally-Up.",
  },
} as const;
