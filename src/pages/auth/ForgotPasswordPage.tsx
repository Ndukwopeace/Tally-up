/**
 * /forgot-password — ask for a password-reset email (AUTH-01, AUTH-06).
 *
 * WHY:  A user who forgot their password must be able to set a new one without
 *       waiting for an admin (an admin reset arrives in A2, USR-04).
 * HOW:  One email field. Supabase sends the email; its link opens
 *       /reset-password on this same site. After sending, the form is replaced
 *       by a confirmation and a way back to sign in.
 * WHEN: From "Forgot password?" on the login page.
 * SECURITY: The confirmation is the same whether or not the email has an
 *       account, so this page cannot be used to discover accounts. The link
 *       target is built from this site's own address, never from user input.
 *       Supabase limits how many emails can be sent (rate_limited).
 */
import { useRef, useState, type SubmitEvent } from "react";
import { Link } from "react-router";

import { useAuth } from "@/auth/useAuth";
import { FormMessage } from "@/components/common/FormMessage";
import { SubmitButton } from "@/components/common/SubmitButton";
import { TextField } from "@/components/common/TextField";
import { validateEmail, type EmailError } from "@/domain/validation";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { en } from "@/i18n/en";
import { AuthLayout } from "@/layouts/AuthLayout";
import type { AuthErrorCode } from "@/services/interfaces/AuthService";

const linkClass =
  "inline-flex min-h-12 items-center self-center rounded-control px-3 text-base font-semibold text-brand underline-offset-4 hover:underline";

export function ForgotPasswordPage() {
  const { store } = useAuth();
  const online = useOnlineStatus();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<EmailError | null>(null);
  const [failure, setFailure] = useState<AuthErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateEmail(email);
    setFieldError(error);
    if (error) {
      emailRef.current?.focus();
      return;
    }
    setFailure(null);
    setPending(true);
    const code = await store.requestPasswordReset(email, `${window.location.origin}/reset-password`);
    setPending(false);
    if (code) {
      setFailure(code);
    } else {
      setSentTo(email.trim());
    }
  }

  return (
    <AuthLayout title={en.auth.forgotTitle} backTo="/login">
      <div>
        <h1 className="text-2xl font-bold text-ink">{en.auth.forgotTitle}</h1>
        {sentTo ? null : <p className="mt-1 text-base text-ink-muted">{en.auth.forgotIntro}</p>}
      </div>

      {sentTo ? (
        <FormMessage tone="success">{en.auth.linkSent(sentTo)}</FormMessage>
      ) : (
        <form noValidate onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-5">
          {failure ? <FormMessage tone="error">{en.auth.errors[failure]}</FormMessage> : null}
          <TextField
            ref={emailRef}
            id="forgot-email"
            label={en.auth.email}
            type="email"
            inputMode="email"
            autoComplete="username"
            value={email}
            onValueChange={setEmail}
            error={fieldError ? en.auth.fieldErrors[fieldError] : undefined}
          />
          <SubmitButton
            pending={pending}
            pendingLabel={en.auth.sending}
            disabled={!online}
            disabledReason={en.auth.offline}
          >
            {en.auth.sendLink}
          </SubmitButton>
        </form>
      )}

      <Link to="/login" className={linkClass}>
        {en.auth.backToSignIn}
      </Link>
    </AuthLayout>
  );
}
