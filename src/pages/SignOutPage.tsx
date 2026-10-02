/**
 * "Sign out?" confirmation, inside each portal (…/sign-out).
 *
 * WHY:  Q-53 puts a Back arrow on every screen, including Home. Back from Home
 *       has nowhere earlier to go inside the app, so it leads here: leaving the
 *       app is a deliberate choice, not an accidental tap (N3, N5). The account
 *       menu's and Profile's Sign Out lead here too, so there is one way to
 *       sign out and one place that handles it.
 * HOW:  Heading, one line of consequence, "Sign Out" (primary) and "Stay signed
 *       in" (back to the portal home). Signing out ends the session; the
 *       portal's route guard then replaces this page with /login, so Back
 *       cannot reopen the portal.
 * WHEN: Back on a portal home; Sign Out in the account menu or Profile.
 * SECURITY: Ends the Supabase session on this device (scope "local"); the
 *       device holds no valid token afterwards, even if offline at that moment.
 */
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { PageTitle } from "./PageTitle";

import { PORTAL_HOME } from "@/auth/access";
import { useAuth } from "@/auth/useAuth";
import { Button, buttonVariants } from "@/components/ui/button";
import { en } from "@/i18n/en";

export function SignOutPage() {
  const { state, store } = useAuth();
  const [pending, setPending] = useState(false);
  const home = state.status === "signed_in" ? PORTAL_HOME[state.account.role] : "/";

  async function signOut() {
    setPending(true);
    // Once signed out, RequireRole swaps this page for /login (replacing it in history).
    await store.signOut();
  }

  return (
    <>
      <PageTitle title={en.signOut.title} subtitle={en.signOut.body} />
      <div className="flex flex-col gap-3">
        <Button size="block" disabled={pending} aria-busy={pending} onClick={() => void signOut()}>
          {pending ? (
            <>
              <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
              {en.signOut.signingOut}
            </>
          ) : (
            en.signOut.confirm
          )}
        </Button>
        <Link to={home} className={buttonVariants({ variant: "secondary", size: "block" })}>
          {en.signOut.cancel}
        </Link>
      </div>
    </>
  );
}
