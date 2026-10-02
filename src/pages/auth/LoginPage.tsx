/**
 * /login — sign in with email and password (AUTH-01, AUTH-03, AUTH-04, AUTH-05).
 *
 * WHY:  Accounts are created by an admin only (AUTH-02), so this page is the
 *       way in. Refusals must say why in plain words (N9): wrong password,
 *       unknown account, inactive account, role not open yet.
 * HOW:  Layout A (AuthLayout). Email + password form checked on submit
 *       (domain/validation.ts); the first wrong field gets focus. The AuthStore
 *       does the sign-in; once signed in, this page redirects to the page the
 *       user first asked for, or their portal home (AUTH-07). Google is shown
 *       but disabled with "Not available yet" until the owner adds the Google
 *       OAuth client (AUTH-05). The install card stays here, where the old start
 *       page had it, so new phones can still install the app.
 * WHEN: Any visit while signed out.
 * SECURITY: The same message is shown for an unknown email and a wrong
 *       password, so nobody can find out which emails have accounts. Sign-in
 *       is blocked offline (NFR-06). The password field uses
 *       autocomplete="current-password" so password managers can fill it.
 */
import { useId, useRef, useState, type SubmitEvent } from "react";
import { Link, Navigate, useLocation } from "react-router";

import { pathAfterSignIn } from "@/auth/access";
import { CheckingSignIn } from "@/auth/StartupScreens";
import { useAuth } from "@/auth/useAuth";
import { FormMessage } from "@/components/common/FormMessage";
import { SubmitButton } from "@/components/common/SubmitButton";
import { TextField } from "@/components/common/TextField";
import { Button } from "@/components/ui/button";
import { validateSignIn, type SignInErrors } from "@/domain/validation";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { en } from "@/i18n/en";
import { AuthLayout } from "@/layouts/AuthLayout";
import { InstallPrompt } from "@/pwa/InstallPrompt";
import type { AuthErrorCode } from "@/services/interfaces/AuthService";

// The page the guard sent us from, if any (RequireRole puts it in the location state).
function requestedPath(state: unknown): string | undefined {
  if (typeof state === "object" && state !== null && "from" in state && typeof state.from === "string") {
    return state.from;
  }
  return undefined;
}

export function LoginPage() {
  const { state, store } = useAuth();
  const location = useLocation();
  const online = useOnlineStatus();
  const googleNoteId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SignInErrors>({});
  const [refusal, setRefusal] = useState<AuthErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  if (state.status === "loading") {
    return <CheckingSignIn />;
  }
  // RULE AUTH-07: signed in (now or already) → the requested page or the portal home.
  if (state.status === "signed_in") {
    return <Navigate to={pathAfterSignIn(state.account.role, requestedPath(location.state))} replace />;
  }

  // A refusal from this form wins; otherwise one from start-up (e.g. "account inactive").
  const shownRefusal = refusal ?? (state.status === "signed_out" ? state.notice : null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateSignIn({ email, password });
    setFieldErrors(errors);
    // WCAG 3.3.1: move focus to the first field that needs fixing.
    if (errors.email) {
      emailRef.current?.focus();
      return;
    }
    if (errors.password) {
      passwordRef.current?.focus();
      return;
    }
    setRefusal(null);
    setPending(true);
    const code = await store.signIn(email, password);
    setPending(false);
    setRefusal(code);
  }

  return (
    <AuthLayout title={en.auth.signInTitle}>
      <div>
        <h1 className="text-2xl font-bold text-ink">{en.auth.signInTitle}</h1>
        <p className="mt-1 text-base text-ink-muted">{en.auth.signInIntro}</p>
      </div>

      {shownRefusal ? <FormMessage tone="error">{en.auth.errors[shownRefusal]}</FormMessage> : null}
      {state.status === "error" && !shownRefusal ? (
        <FormMessage tone="error">{en.auth.startError}</FormMessage>
      ) : null}

      {/* noValidate: our own messages replace the browser's, which vary by phone and language. */}
      <form noValidate onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-5">
        <TextField
          ref={emailRef}
          id="login-email"
          label={en.auth.email}
          type="email"
          inputMode="email"
          autoComplete="username"
          value={email}
          onValueChange={setEmail}
          error={fieldErrors.email ? en.auth.fieldErrors[fieldErrors.email] : undefined}
        />
        <TextField
          ref={passwordRef}
          id="login-password"
          label={en.auth.password}
          type="password"
          autoComplete="current-password"
          value={password}
          onValueChange={setPassword}
          error={fieldErrors.password ? en.auth.fieldErrors[fieldErrors.password] : undefined}
        />
        <SubmitButton
          pending={pending}
          pendingLabel={en.auth.signingIn}
          disabled={!online}
          disabledReason={en.auth.offline}
        >
          {en.auth.signIn}
        </SubmitButton>
        <Link
          to="/forgot-password"
          className="inline-flex min-h-12 items-center self-center rounded-control px-3 text-base font-semibold text-brand underline-offset-4 hover:underline"
        >
          {en.auth.forgotLink}
        </Link>
      </form>

      {/* RULE AUTH-05: visible but disabled until the owner adds the Google OAuth client. */}
      <div className="flex flex-col gap-1.5">
        <p className="text-center text-sm text-ink-muted">{en.auth.or}</p>
        <Button variant="secondary" size="block" disabled aria-describedby={googleNoteId}>
          {en.auth.google}
        </Button>
        <p id={googleNoteId} className="text-center text-sm text-ink-muted">
          {en.auth.googleNotYet}
        </p>
      </div>

      <InstallPrompt />
    </AuthLayout>
  );
}
