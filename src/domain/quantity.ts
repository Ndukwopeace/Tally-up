/**
 * Reads a quantity typed by a user and turns it into a whole number.
 *
 * WHY:  Every quantity in Tally-Up (collected, handed over, counted) is a whole
 *       number of loaves, packs or caisse (Q-20). People type numbers in
 *       different ways ("1500", "1,500", "1 500"), so input is accepted
 *       generously but saved strictly (UI_GUIDELINES §1.7, rules P-1 and P-3).
 * HOW:  1. Trim the text. Empty → "empty".
 *       2. A leading minus → "negative".
 *       3. Accept plain digits, or digits grouped in threes by single commas or
 *          spaces (including the non-breaking spaces French formatting uses).
 *          Anything else → "not_whole_number".
 *       4. Remove the separators and convert. Beyond the largest exactly
 *          storable integer → "too_large".
 * WHEN: Called by QuantityInput on every keystroke, and by any service that
 *       accepts a quantity before it is saved.
 * SECURITY: Pure function, no I/O. Rejecting decimals, negatives, exponents
 *       ("1e3"), hex ("0x10") and signs ("+5") means only plain whole numbers
 *       can ever reach a balance calculation. The database re-checks (SEC-1).
 */

/** Why a quantity could not be read. Each reason maps to one message in i18n/en.ts. */
export type QuantityError = "empty" | "not_whole_number" | "negative" | "too_large";

/** Result of reading a quantity: either a safe whole number or the reason it was refused. */
export type QuantityResult = { ok: true; value: number } | { ok: false; reason: QuantityError };

// Plain ASCII digits only: "0", "200", "1500".
const PLAIN_DIGITS = /^[0-9]+$/;

// RULE P-1: 1–3 digits, then groups of exactly three digits, each group preceded
// by ONE comma, space, no-break space (U+00A0) or narrow no-break space (U+202F).
// Exactly-three grouping matters: "1,5" may be a French decimal comma (1.5),
// so it must be refused rather than read as 15.
const GROUPED_DIGITS = /^[0-9]{1,3}(?:[, \u00a0\u202f][0-9]{3})+$/;

// Separators removed after the grouping has been validated.
const SEPARATORS = /[, \u00a0\u202f]/g;

export function parseQuantity(raw: string): QuantityResult {
  const text = raw.trim();

  // Nothing typed yet: the caller decides whether that is allowed.
  if (text === "") {
    return { ok: false, reason: "empty" };
  }

  // RULE VAL (REQUIREMENTS §10): quantities can never be negative.
  // SECURITY: a negative hand-over would inflate the remaining stock.
  if (text.startsWith("-")) {
    return { ok: false, reason: "negative" };
  }

  // RULE Q-20: whole numbers only. Decimals, letters, exponents, signs and
  // non-ASCII digits all fail both patterns.
  if (!PLAIN_DIGITS.test(text) && !GROUPED_DIGITS.test(text)) {
    return { ok: false, reason: "not_whole_number" };
  }

  const value = Number(text.replace(SEPARATORS, ""));

  // Above 2^53 − 1 JavaScript numbers lose precision, so the value saved
  // could differ from the value typed.
  if (!Number.isSafeInteger(value)) {
    return { ok: false, reason: "too_large" };
  }

  return { ok: true, value };
}
