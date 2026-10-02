/**
 * Profile / My Account (REQUIREMENTS §7 "Profile (all roles)", Q-47).
 *
 * WHY:  A user needs to see which account they are using, change their
 *       password, and sign out. §7 lists exactly: name, email, role, assigned
 *       depot (managers, from A2/DM1), change password, sign out. Nothing else.
 * HOW:  Reads the signed-in account from the AuthStore. Change password reuses
 *       NewPasswordForm and confirms success in place. Sign Out acts at once and
 *       shows "Signing out…" while it works (Q-56).
 * WHEN: /admin/profile (account menu). Other roles get it in their milestones.
 * SECURITY: Shows only the user's own data, which RLS limits to their own
 *       profile row anyway (AUTH-10). Changing the password needs the signed-in
 *       session; Supabase may also ask for re-authentication depending on the
 *       owner's settings.
 */
import { LoaderCircle } from "lucide-react";
import { useState } from "react";

import { PageTitle } from "./PageTitle";

import { useSignOut } from "@/auth/useSignOut";
import { useAuth } from "@/auth/useAuth";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { FormMessage } from "@/components/common/FormMessage";
import { Button } from "@/components/ui/button";
import { en } from "@/i18n/en";

export function ProfilePage() {
  const { state } = useAuth();
  const [passwordSaved, setPasswordSaved] = useState(false);
  const { signOut, signingOut } = useSignOut();

  // The route guard renders this page only when signed in; nothing to show otherwise.
  if (state.status !== "signed_in") {
    return null;
  }
  const { account } = state;

  const rows: [string, string][] = [
    [en.profile.name, account.fullName],
    [en.profile.email, account.email],
    [en.profile.role, en.roles[account.role]],
  ];

  return (
    <>
      <PageTitle title={en.nav.profileAccount} />
      <dl className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5 px-4 py-3">
            <dt className="text-sm text-ink-muted">{label}</dt>
            {/* break-words: long email addresses wrap instead of widening the page. */}
            <dd className="text-base font-semibold break-words text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="change-password" className="mt-8 flex flex-col gap-4">
        <h2 id="change-password" className="text-lg font-semibold text-ink">
          {en.profile.changePassword}
        </h2>
        {passwordSaved ? <FormMessage tone="success">{en.auth.passwordSaved}</FormMessage> : null}
        <NewPasswordForm
          idPrefix="profile"
          onSaved={() => {
            setPasswordSaved(true);
          }}
        />
      </section>

      <Button
        variant="secondary"
        size="block"
        className="mt-8"
        disabled={signingOut}
        aria-busy={signingOut}
        onClick={() => void signOut()}
      >
        {signingOut ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
            {en.signOut.signingOut}
          </>
        ) : (
          en.nav.signOut
        )}
      </Button>
    </>
  );
}
