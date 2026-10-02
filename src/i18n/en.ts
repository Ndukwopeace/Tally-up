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
import type { AuthErrorCode } from "@/services/interfaces/AuthService";
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

  // Sign-out confirmation (Back on Home, §7).
  signOut: {
    title: "Sign out?",
    body: "You will need your email and password to sign in again.",
    confirm: "Sign Out",
    signingOut: "Signing out…",
    cancel: "Stay signed in",
  },

  // Profile / My Account (§7: name, email, role, change password, sign out).
  profile: {
    name: "Name",
    email: "Email",
    role: "Role",
    changePassword: "Change password",
  },

  // Shown when a build has no database settings (config/env.ts).
  config: {
    title: "Tally-Up is not connected",
    body: "This copy of the app has no database settings. Tell the person who manages Tally-Up.",
  },
} as const;
