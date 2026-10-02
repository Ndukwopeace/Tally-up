/**
 * Form checks for signing in and choosing a password (SEC-5).
 *
 * WHY:  Users get instant, specific feedback before anything is sent (N5, D-3),
 *       and the same checks are reused by every form that asks for them.
 * HOW:  Pure functions returning error *codes* (no wording, no React); pages
 *       turn codes into text from i18n/en.ts. Zod checks the email format.
 * WHEN: On submit of the login, forgot-password, reset-password and Profile forms.
 * SECURITY: Convenience only: Supabase validates again. Password *strength* is
 *       left to Supabase's own policy (set by the owner in the Supabase
 *       dashboard), so the app never invents a password rule of its own.
 */
import { z } from "zod/mini";

export type EmailError = "email_required" | "email_invalid";
export type SignInErrors = Partial<{ email: EmailError; password: "password_required" }>;
export type NewPasswordErrors = Partial<{ password: "new_password_required"; repeat: "passwords_differ" }>;

const emailSchema = z.email();

/** Null when `email` looks like a usable address. */
export function validateEmail(email: string): EmailError | null {
  const trimmed = email.trim();
  if (trimmed === "") {
    return "email_required";
  }
  return emailSchema.safeParse(trimmed).success ? null : "email_invalid";
}

/** RULE AUTH-03: both fields are required. */
export function validateSignIn({
  email,
  password,
}: Readonly<{ email: string; password: string }>): SignInErrors {
  const errors: SignInErrors = {};
  const emailError = validateEmail(email);
  if (emailError) {
    errors.email = emailError;
  }
  // Passwords are compared exactly as typed; spaces may be part of them.
  if (password === "") {
    errors.password = "password_required";
  }
  return errors;
}

/** A new password must be entered and repeated identically (guards against typos). */
export function validateNewPassword({
  password,
  repeat,
}: Readonly<{ password: string; repeat: string }>): NewPasswordErrors {
  if (password === "") {
    return { password: "new_password_required" };
  }
  return password === repeat ? {} : { repeat: "passwords_differ" };
}
