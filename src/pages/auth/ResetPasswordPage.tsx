/**
 * /reset-password — choose a new password from the emailed link (AUTH-06).
 *
 * WHY:  The forgot-password email lands here. The user must be able to set a
 *       new password and continue into the app, or be told plainly that the
 *       link no longer works and how to get a new one (N9).
 * HOW:  supabase-js reads the session carried by the link when the app starts,
 *       so the AuthStore is already "signed in" here if the link is valid.
 *         checking        → skeleton
 *         signed in       → NewPasswordForm; afterwards a confirmation with Continue
 *         signed out      → "This link no longer works" + "Ask for a new link"
 *                           (or the refusal reason, e.g. account inactive)
 * WHEN: Opened from the reset email; also works for a signed-in user.
 * SECURITY: A valid link is a one-time session issued by Supabase; an expired
 *       or reused link gives no session, so the form is not shown. Accounts
 *       refused by the AuthStore (inactive, role not open) are signed out before
 *       they reach the form.
 */
import { useState } from "react";
import { Link } from "react-router";

import { CheckingSignIn, SignInCheckFailed } from "@/auth/StartupScreens";
import { useAuth } from "@/auth/useAuth";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { FormMessage } from "@/components/common/FormMessage";
import { buttonVariants } from "@/components/ui/button";
import { en } from "@/i18n/en";
import { AuthLayout } from "@/layouts/AuthLayout";

export function ResetPasswordPage() {
  const { state } = useAuth();
  const [saved, setSaved] = useState(false);

  if (state.status === "loading") {
    return <CheckingSignIn />;
  }
  if (state.status === "error") {
    return <SignInCheckFailed />;
  }

  if (state.status === "signed_out") {
    return (
      <AuthLayout title={en.auth.linkExpiredTitle}>
        <div>
          <h1 className="text-2xl font-bold text-ink">{en.auth.linkExpiredTitle}</h1>
          {state.notice ? null : <p className="mt-1 text-base text-ink-muted">{en.auth.linkExpiredBody}</p>}
        </div>
        {state.notice ? <FormMessage tone="error">{en.auth.errors[state.notice]}</FormMessage> : null}
        <Link to="/forgot-password" className={buttonVariants({ variant: "primary", size: "block" })}>
          {en.auth.askNewLink}
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={en.auth.resetTitle}>
      <h1 className="text-2xl font-bold text-ink">{en.auth.resetTitle}</h1>
      {saved ? (
        <>
          <FormMessage tone="success">{en.auth.passwordSaved}</FormMessage>
          {/* "/" sends the user to their own portal (AUTH-07). */}
          <Link to="/" replace className={buttonVariants({ variant: "primary", size: "block" })}>
            {en.auth.continue}
          </Link>
        </>
      ) : (
        <NewPasswordForm
          idPrefix="reset"
          onSaved={() => {
            setSaved(true);
          }}
        />
      )}
    </AuthLayout>
  );
}
