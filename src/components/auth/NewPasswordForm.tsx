/**
 * Form to set a new password: used by /reset-password and by Profile.
 *
 * WHY:  Both places ask the same thing; one form keeps the wording and the
 *       checks identical (N4, DRY).
 * HOW:  New password + repeat, checked on submit (domain/validation.ts), then
 *       AuthStore.updatePassword. Supabase applies the password policy and its
 *       refusals ("too weak", "same as before") come back as plain messages.
 *       `onSaved` lets the page decide what success looks like.
 * WHEN: Reset link landing page; Profile / My Account.
 * SECURITY: autocomplete="new-password" lets password managers suggest a
 *       strong password. The password is never stored or logged by the app.
 *       Saving is blocked offline (NFR-06).
 */
import { useRef, useState, type SubmitEvent } from "react";

import { useAuth } from "@/auth/useAuth";
import { FormMessage } from "@/components/common/FormMessage";
import { SubmitButton } from "@/components/common/SubmitButton";
import { TextField } from "@/components/common/TextField";
import { validateNewPassword, type NewPasswordErrors } from "@/domain/validation";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { en } from "@/i18n/en";
import type { AuthErrorCode } from "@/services/interfaces/AuthService";

export function NewPasswordForm({ idPrefix, onSaved }: Readonly<{ idPrefix: string; onSaved: () => void }>) {
  const { store } = useAuth();
  const online = useOnlineStatus();
  const passwordRef = useRef<HTMLInputElement>(null);
  const repeatRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<NewPasswordErrors>({});
  const [failure, setFailure] = useState<AuthErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateNewPassword({ password, repeat });
    setErrors(found);
    if (found.password) {
      passwordRef.current?.focus();
      return;
    }
    if (found.repeat) {
      repeatRef.current?.focus();
      return;
    }
    setFailure(null);
    setPending(true);
    const code = await store.updatePassword(password);
    setPending(false);
    if (code) {
      setFailure(code);
      return;
    }
    // Clear the fields so the new password does not stay on screen.
    setPassword("");
    setRepeat("");
    onSaved();
  }

  return (
    <form noValidate onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-5">
      {failure ? <FormMessage tone="error">{en.auth.errors[failure]}</FormMessage> : null}
      <TextField
        ref={passwordRef}
        id={`${idPrefix}-new-password`}
        label={en.auth.newPassword}
        type="password"
        autoComplete="new-password"
        value={password}
        onValueChange={setPassword}
        error={errors.password ? en.auth.fieldErrors[errors.password] : undefined}
      />
      <TextField
        ref={repeatRef}
        id={`${idPrefix}-repeat-password`}
        label={en.auth.repeatPassword}
        type="password"
        autoComplete="new-password"
        value={repeat}
        onValueChange={setRepeat}
        error={errors.repeat ? en.auth.fieldErrors[errors.repeat] : undefined}
      />
      <SubmitButton pending={pending} disabled={!online} disabledReason={en.auth.offline}>
        {en.auth.savePassword}
      </SubmitButton>
    </form>
  );
}
