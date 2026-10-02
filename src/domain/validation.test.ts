/**
 * Tests for the sign-in and password form checks.
 *
 * Rules under test: AUTH-03 (email + password), SEC-5 (input validated at the
 * form), and the new-password check used by reset and Profile.
 */
import { describe, expect, it } from "vitest";

import { validateEmail, validateNewPassword, validateSignIn } from "./validation";

describe("validateEmail", () => {
  it.each([
    ["", "email_required"],
    ["   ", "email_required"],
    ["ama", "email_invalid"],
    ["ama@", "email_invalid"],
    ["ama@bakery", "email_invalid"],
  ])("%j → %s", (email, code) => {
    expect(validateEmail(email)).toBe(code);
  });

  it("accepts an address, ignoring spaces around it", () => {
    expect(validateEmail(" ama@bakery.cm ")).toBeNull();
  });
});

describe("validateSignIn", () => {
  it("needs an email and a password", () => {
    expect(validateSignIn({ email: "", password: "" })).toEqual({
      email: "email_required",
      password: "password_required",
    });
  });

  it("passes a complete form; the password is never trimmed or judged here", () => {
    expect(validateSignIn({ email: "ama@bakery.cm", password: " x " })).toEqual({});
  });
});

describe("validateNewPassword", () => {
  it("needs a password, typed the same twice", () => {
    expect(validateNewPassword({ password: "", repeat: "" })).toEqual({ password: "new_password_required" });
    expect(validateNewPassword({ password: "abc12345", repeat: "abc1234" })).toEqual({
      repeat: "passwords_differ",
    });
    expect(validateNewPassword({ password: "abc12345", repeat: "abc12345" })).toEqual({});
  });
});
