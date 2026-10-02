/**
 * What the screen shows while the saved sign-in is being checked, or if that check failed.
 *
 * WHY:  At start-up the app cannot know yet which portal (if any) to show.
 *       A skeleton keeps the screen calm (D-2); a failure says what happened
 *       and offers "Try again" instead of wrongly showing the login page (N9).
 * HOW:  Two small components used by the route guard and the "/" redirect.
 * WHEN: The first moments of every visit; after a failed check.
 * SECURITY: Display only.
 */
import { useAuth } from "./useAuth";

import { ErrorState } from "@/components/common/ErrorState";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import { en } from "@/i18n/en";
import { AuthLayout } from "@/layouts/AuthLayout";

export function CheckingSignIn() {
  // Same side and top spacing as the pages that follow, so nothing jumps when they appear.
  return (
    <div className="mx-auto max-w-xl pt-[max(1.5rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
      <PageSkeleton />
    </div>
  );
}

export function SignInCheckFailed() {
  const { store } = useAuth();
  return (
    <AuthLayout title={en.states.errorTitle}>
      <ErrorState
        message={en.auth.startError}
        onRetry={() => {
          void store.start();
        }}
      />
    </AuthLayout>
  );
}
