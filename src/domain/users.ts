/**
 * User form rules (USR-01 to USR-03, USR-06, Q-57a, Q-57c, Q-57g, Q-57i).
 *
 * WHY:  Instant, specific messages before saving (N5); the database checks the
 *       same rules again in admin_save_user, so the browser is never trusted.
 * HOW:  Pure functions over plain form values. Phone numbers are read with
 *       domain/phone.ts and stored as +237XXXXXXXXX; empty rows and repeats are
 *       dropped. Only an active depot manager keeps a depot (USR-03, Q-57c), so
 *       the depot is cleared for every other case. `depotConsequences` says who
 *       would lose a depot when the form is saved, and `isLastActiveAdmin`
 *       tells the form to lock the role (USR-06).
 * WHEN: The user form (pages/admin/UserFormPage.tsx).
 * SECURITY: Convenience only; the database function enforces every rule.
 */
import { formatCameroonPhone, normalizeCameroonPhone } from "./phone";
import { validateEmail, validateNewPassword, type EmailError } from "./validation";

import type { Depot, DepotManagerRef, User } from "@/types/entities";
import type { RecordStatus, Role } from "@/types/enums";

export interface UserFormValues {
  fullName: string;
  email: string;
  /** Phone numbers as typed, one per row (Q-57i: one or more, optional). */
  phones: string[];
  role: Role;
  /** The chosen depot's id; used only for an active depot manager. */
  depotId: string | null;
  active: boolean;
  /** Q-57a: the temporary password the admin types, used only when creating. */
  password: string;
  repeat: string;
}

export interface UserFormErrors {
  fullName?: "name_required";
  email?: EmailError;
  /** Errors by phone row index. */
  phones?: Record<number, "phone_invalid">;
  depot?: "depot_required";
  password?: "new_password_required";
  repeat?: "passwords_differ";
}

/** What is sent to the server once the form is valid. */
export interface UserSaveInput {
  fullName: string;
  email: string;
  phones: string[];
  role: Role;
  status: RecordStatus;
  depotId: string | null;
}

/** A blank form for a new account: an active distributor with one empty phone row. */
export function emptyUserForm(): UserFormValues {
  return {
    fullName: "",
    email: "",
    phones: [""],
    role: "distributor",
    depotId: null,
    active: true,
    password: "",
    repeat: "",
  };
}

/** The form for editing a saved account (no password: that has its own form, Q-57b). */
export function userFormFrom(user: User): UserFormValues {
  return {
    fullName: user.fullName,
    email: user.email,
    phones: user.phones.length > 0 ? user.phones.map(formatCameroonPhone) : [""],
    role: user.role,
    depotId: user.depot === null ? null : user.depot.id,
    active: user.status === "active",
    password: "",
    repeat: "",
  };
}

// RULE USR-03 / Q-57c: only an active depot manager has a depot.
function keepsDepot(values: Pick<UserFormValues, "role" | "active">): boolean {
  return values.role === "depot_manager" && values.active;
}

/**
 * Checks the whole form. `input` is present only when there are no errors;
 * `password` only when creating (Q-57a).
 */
export function validateUserForm(
  values: UserFormValues,
  { creating }: Readonly<{ creating: boolean }>,
): { errors: UserFormErrors; input?: UserSaveInput; password?: string } {
  const errors: UserFormErrors = {};
  const fullName = values.fullName.trim();

  // RULE USR-02: full name and email are required (the email is the login).
  if (fullName === "") {
    errors.fullName = "name_required";
  }
  const emailError = validateEmail(values.email);
  if (emailError) {
    errors.email = emailError;
  }

  // RULE Q-57i: optional, any number of them, each a valid Cameroon number.
  const phones: string[] = [];
  const phoneErrors: Record<number, "phone_invalid"> = {};
  values.phones.forEach((raw, index) => {
    if (raw.trim() === "") {
      return;
    }
    const stored = normalizeCameroonPhone(raw);
    if (stored === null) {
      phoneErrors[index] = "phone_invalid";
    } else if (!phones.includes(stored)) {
      phones.push(stored);
    }
  });
  if (Object.keys(phoneErrors).length > 0) {
    errors.phones = phoneErrors;
  }

  // RULE USR-03: an active depot manager needs a depot.
  if (keepsDepot(values) && values.depotId === null) {
    errors.depot = "depot_required";
  }

  // RULE Q-57a: a new account needs the temporary password the admin types, twice.
  if (creating) {
    Object.assign(errors, validateNewPassword({ password: values.password, repeat: values.repeat }));
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }
  return {
    errors,
    input: {
      fullName,
      email: values.email.trim().toLowerCase(),
      phones,
      role: values.role,
      status: values.active ? "active" : "inactive",
      // RULE USR-03 / Q-57c / Q-57g: any other case has no depot.
      depotId: keepsDepot(values) ? values.depotId : null,
    },
    password: creating ? values.password : undefined,
  };
}

/**
 * RULE DEP-03 / Q-57c: what saving would do to depots. `replaced` is the manager
 * who will be deactivated because the chosen depot already has one; `leaves` is
 * the name of the depot this account runs now and will no longer run.
 */
export function depotConsequences(
  values: Pick<UserFormValues, "role" | "active" | "depotId">,
  user: User | undefined,
  depots: readonly Depot[],
): { replaced: DepotManagerRef | null; leaves: string | null } {
  const target = keepsDepot(values) ? depots.find((depot) => depot.id === values.depotId) : undefined;
  const current = user?.depot ?? null;
  const replaced = target?.manager && target.manager.id !== user?.id ? target.manager : null;
  const leaves = current !== null && current.id !== target?.id ? current.name : null;
  return { replaced, leaves };
}

/** RULE USR-06 / Q-57f: true when `id` is the only active admin. */
export function isLastActiveAdmin(users: readonly User[], id: string): boolean {
  const activeAdmins = users.filter((user) => user.role === "admin" && user.status === "active");
  return activeAdmins.length === 1 && activeAdmins[0]?.id === id;
}

/**
 * RULE Q-58: the depots an admin may give to a depot manager: active ones only.
 * `currentDepotId` is the depot the account already runs; it stays in the list
 * even if it became inactive, so editing the account does not lose it.
 */
export function assignableDepots(depots: readonly Depot[], currentDepotId: string | null): Depot[] {
  return depots.filter((depot) => depot.status === "active" || depot.id === currentDepotId);
}
