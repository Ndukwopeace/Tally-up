/**
 * Product form rules: what a valid product is, and how Caisse amounts become loaves.
 *
 * WHY:  PRD-02 to PRD-05 and Q-57d/h decide what the admin may save. Checking
 *       here gives instant, specific messages (N5); the database checks the
 *       same rules again (admin_save_product), so the browser is never trusted.
 * HOW:  Pure functions over plain form values, no React. Description is
 *       optional (Q-57j). Errors are codes;
 *       pages turn them into words from i18n/en.ts.
 * WHEN: The product form (pages/admin/ProductFormPage.tsx) on every change
 *       and on save; the product list for unit summaries.
 * SECURITY: Convenience only; the database function enforces every rule.
 */
import type { Product, ProductUnitLoaves } from "@/types/entities";
import type { RecordStatus } from "@/types/enums";

/** RULE Q-57h: letters, numbers and dashes, 1 to 20 characters. Same pattern as the database. */
const CODE_PATTERN = /^[A-Za-z0-9-]{1,20}$/;

/** Largest number Postgres `integer` can store; a bigger Caisse cannot be saved. */
const MAX_STORABLE = 2_147_483_647;

/** How the admin types a Caisse (PRD-05). */
export type CaisseMode = "loaves" | "packs";

export interface ProductFormValues {
  name: string;
  code: string;
  description: string;
  /** Active (true) or Inactive (false), PRD-01. */
  active: boolean;
  pack: { on: boolean; loaves: number | null };
  /** `count` is loaves or packs depending on `mode`. */
  caisse: { on: boolean; mode: CaisseMode; count: number | null };
}

export type ProductFieldError =
  | "name_required"
  | "code_required"
  | "code_invalid"
  | "loaves_required"
  | "loaves_min_one"
  | "caisse_needs_pack"
  | "too_large";

export type ProductFormErrors = Partial<
  Record<"name" | "code" | "packLoaves" | "caisseCount", ProductFieldError>
>;

/** What is sent to the database once the form is valid. */
export interface ProductSaveInput {
  name: string;
  code: string;
  description: string;
  status: RecordStatus;
  packLoaves: number | null;
  caisseLoaves: number | null;
}

/** A blank form for a new product: Active, Loaf only. */
export function emptyProductForm(): ProductFormValues {
  return {
    name: "",
    code: "",
    description: "",
    active: true,
    pack: { on: false, loaves: null },
    caisse: { on: false, mode: "loaves", count: null },
  };
}

/** The form for editing a saved product. Caisse is shown in loaves, as stored. */
export function productFormFrom(product: Product): ProductFormValues {
  return {
    name: product.name,
    code: product.code,
    description: product.description,
    active: product.status === "active",
    pack: { on: product.packLoaves !== null, loaves: product.packLoaves },
    caisse: { on: product.caisseLoaves !== null, mode: "loaves", count: product.caisseLoaves },
  };
}

/**
 * RULE PRD-05: loaves in one Caisse, from loaves or from packs × loaves per pack.
 * Null when Caisse is off or the numbers needed are missing.
 */
export function caisseLoaves(values: ProductFormValues): number | null {
  const { caisse, pack } = values;
  if (!caisse.on || caisse.count === null) {
    return null;
  }
  if (caisse.mode === "loaves") {
    return caisse.count;
  }
  return pack.on && pack.loaves !== null ? caisse.count * pack.loaves : null;
}

// A required whole number of loaves, at least one (PRD-04).
function loavesError(value: number | null): ProductFieldError | undefined {
  if (value === null) {
    return "loaves_required";
  }
  return value < 1 ? "loaves_min_one" : undefined;
}

/** Checks the whole form. `input` is present only when there are no errors. */
export function validateProductForm(values: ProductFormValues): {
  errors: ProductFormErrors;
  input?: ProductSaveInput;
} {
  const errors: ProductFormErrors = {};
  const name = values.name.trim();
  const code = values.code.trim();
  const description = values.description.trim();

  if (name === "") {
    errors.name = "name_required";
  }
  if (code === "") {
    errors.code = "code_required";
  } else if (!CODE_PATTERN.test(code)) {
    errors.code = "code_invalid";
  }

  // RULE PRD-03 / Q-57d: Loaf is always on; Pack is optional.
  const packError = values.pack.on ? loavesError(values.pack.loaves) : undefined;
  if (packError) {
    errors.packLoaves = packError;
  }

  // RULE PRD-05: Caisse in loaves, or in packs (which needs Pack set up).
  if (values.caisse.on) {
    const { mode, count } = values.caisse;
    // Loaves per counted item: 1 when typed in loaves, the Pack size when typed in packs.
    const multiplier = mode === "loaves" ? 1 : values.pack.on ? values.pack.loaves : null;
    if (count === null || count < 1) {
      errors.caisseCount = loavesError(count);
    } else if (multiplier === null) {
      errors.caisseCount = "caisse_needs_pack";
    } else if (count * multiplier > MAX_STORABLE) {
      errors.caisseCount = "too_large";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }
  return {
    errors,
    input: {
      name,
      code,
      description,
      status: values.active ? "active" : "inactive",
      packLoaves: values.pack.on ? values.pack.loaves : null,
      caisseLoaves: caisseLoaves(values),
    },
  };
}

/** A product's units in display order: Loaf, then Pack and Caisse when used. */
export function productUnits(product: Pick<Product, "packLoaves" | "caisseLoaves">): ProductUnitLoaves[] {
  const units: ProductUnitLoaves[] = [{ unit: "Loaf", loaves: 1 }];
  if (product.packLoaves !== null) {
    units.push({ unit: "Pack", loaves: product.packLoaves });
  }
  if (product.caisseLoaves !== null) {
    units.push({ unit: "Caisse", loaves: product.caisseLoaves });
  }
  return units;
}
