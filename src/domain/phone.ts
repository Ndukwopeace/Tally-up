/**
 * Cameroon phone numbers (owner decision Q-57i).
 *
 * WHY:  Depots and users may have several phone numbers, and each must be a
 *       valid Cameroon number. People type them in many ways ("677 12 34 56",
 *       "+237 6 77…", "00237…"); the app stores one form so numbers can be
 *       compared and dialled.
 * HOW:  `normalizeCameroonPhone` removes spaces, dots, dashes and brackets,
 *       drops a +237 / 00237 / 237 prefix, and accepts 9 digits starting with
 *       2 (landline) or 6 (mobile), returning "+237XXXXXXXXX".
 *       `formatCameroonPhone` shows a stored number as "+237 6 77 12 34 56".
 * WHEN: Depot form (A2b) and user form (A2c); lists and detail pages.
 * SECURITY: The database checks the stored form again (is_cameroon_phone_list).
 */

// 9 national digits: 2… landline, 6… mobile.
const NATIONAL = /^[26]\d{8}$/;

/** The stored form "+237XXXXXXXXX", or null when `raw` is not a Cameroon number. */
export function normalizeCameroonPhone(raw: string): string | null {
  let digits = raw.replace(/[\s.()-]/g, "");
  if (digits.startsWith("+237")) {
    digits = digits.slice(4);
  } else if (digits.startsWith("00237")) {
    digits = digits.slice(5);
  } else if (digits.startsWith("237") && digits.length === 12) {
    digits = digits.slice(3);
  }
  return NATIONAL.test(digits) ? `+237${digits}` : null;
}

/** "+237677123456" → "+237 6 77 12 34 56". Anything else is shown unchanged. */
export function formatCameroonPhone(stored: string): string {
  const match = /^\+237(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(stored);
  return match ? `+237 ${match.slice(1).join(" ")}` : stored;
}
