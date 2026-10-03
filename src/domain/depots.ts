/**
 * Depot form rules (DEP-01 to DEP-03, Q-57c, Q-57i).
 *
 * WHY:  Instant, specific messages before saving (N5); the database checks
 *       the same rules again in admin_save_depot, so the browser is never trusted.
 * HOW:  Pure functions over plain form values. Phone numbers are read with
 *       domain/phone.ts and stored as +237XXXXXXXXX; empty rows and repeats are
 *       dropped. `replacedManager` tells the form whose account will be
 *       deactivated when another manager is chosen (Q-57c).
 * WHEN: The depot form (pages/admin/DepotFormPage.tsx).
 * SECURITY: Convenience only; the database function enforces every rule.
 */
import { formatCameroonPhone, normalizeCameroonPhone } from "./phone";

import type { Depot, DepotManagerRef } from "@/types/entities";
import type { RecordStatus } from "@/types/enums";

export interface DepotFormValues {
  name: string;
  location: string;
  address: string;
  /** Phone numbers as typed, one per row (Q-57i: one or more, optional). */
  phones: string[];
  active: boolean;
  /** The chosen manager's id, or null for "no manager / keep as is". */
  managerId: string | null;
}

export type DepotFieldError = "name_required" | "location_required" | "address_required" | "phone_invalid";

export interface DepotFormErrors {
  name?: DepotFieldError;
  location?: DepotFieldError;
  address?: DepotFieldError;
  /** Errors by phone row index. */
  phones?: Record<number, DepotFieldError>;
}

/** What is sent to the database once the form is valid. */
export interface DepotSaveInput {
  name: string;
  location: string;
  address: string;
  phones: string[];
  status: RecordStatus;
  managerId: string | null;
}

/** A blank form for a new depot: Active, one empty phone row, no manager. */
export function emptyDepotForm(): DepotFormValues {
  return { name: "", location: "", address: "", phones: [""], active: true, managerId: null };
}

/** The form for editing a saved depot. */
export function depotFormFrom(depot: Depot): DepotFormValues {
  return {
    name: depot.name,
    location: depot.location,
    address: depot.address,
    phones: depot.phones.length > 0 ? depot.phones.map(formatCameroonPhone) : [""],
    active: depot.status === "active",
    managerId: depot.manager === null ? null : depot.manager.id,
  };
}

/** Checks the whole form. `input` is present only when there are no errors. */
export function validateDepotForm(values: DepotFormValues): {
  errors: DepotFormErrors;
  input?: DepotSaveInput;
} {
  const errors: DepotFormErrors = {};
  const name = values.name.trim();
  const location = values.location.trim();
  const address = values.address.trim();

  // RULE DEP-02: name, location and address are required.
  if (name === "") {
    errors.name = "name_required";
  }
  if (location === "") {
    errors.location = "location_required";
  }
  if (address === "") {
    errors.address = "address_required";
  }

  // RULE Q-57i: optional, any number of them, each a valid Cameroon number.
  const phones: string[] = [];
  const phoneErrors: Record<number, DepotFieldError> = {};
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

  if (Object.keys(errors).length > 0) {
    return { errors };
  }
  return {
    errors,
    input: {
      name,
      location,
      address,
      phones,
      status: values.active ? "active" : "inactive",
      // RULE Q-58c: an inactive depot has no manager.
      managerId: values.active ? values.managerId : null,
    },
  };
}

/**
 * RULE DEP-03 / Q-57c: the manager who will be deactivated if `chosenId` is
 * saved, or null when nobody is replaced.
 */
export function replacedManager(depot: Depot | undefined, chosenId: string | null): DepotManagerRef | null {
  const current = depot?.manager ?? null;
  if (current === null || chosenId === null || chosenId === current.id) {
    return null;
  }
  return current;
}

/**
 * RULE Q-58c: the manager who will be deactivated if `depot` is saved as inactive
 * (an inactive depot has no manager), or null when nobody is affected.
 */
export function managerLosingDepot(depot: Depot | undefined, active: boolean): DepotManagerRef | null {
  return active ? null : (depot?.manager ?? null);
}
