/**
 * Frame for the signed-out pages: login, forgot password, reset password.
 *
 * WHY:  These pages are what an installed app opens on, so they follow the
 *       start-page layout A the owner chose (Q-54): logo at the top, the
 *       heading and form at the bottom within thumb reach (MB-2, Fitts).
 *       Every screen except the login itself has a Back arrow (Q-53).
 * HOW:  Full-height column: top bar (optional Back + logo), then the content
 *       pushed to the bottom. Safe-area padding keeps it clear of the notch
 *       and home indicator. The connection banner sits above the content.
 * WHEN: /login, /forgot-password, /reset-password, and the start-up error screen.
 * SECURITY: Layout only.
 */
import type { ReactNode } from "react";

import { BackButton } from "./BackButton";

import { AppLogo } from "@/components/common/AppLogo";
import { ConnectionBanner } from "@/components/common/ConnectionBanner";
import { en } from "@/i18n/en";

export interface AuthLayoutProps {
  /** Browser-tab title (WCAG 2.4.2). */
  title: string;
  /** Where Back goes; no Back arrow when undefined (the login page is the start). */
  backTo?: string;
  children: ReactNode;
}

export function AuthLayout({ title, backTo, children }: Readonly<AuthLayoutProps>) {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-xl flex-col justify-between gap-10 bg-canvas pt-[max(1.5rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]"
    >
      <title>{`${title} · ${en.app.name}`}</title>
      {/* Top: Back (where there is somewhere to go) and the brand. */}
      <div data-testid="auth-top" className="flex min-h-16 items-center gap-1">
        {backTo ? <BackButton fallback={backTo} /> : null}
        <AppLogo />
      </div>
      {/* Bottom: what to do, in thumb reach. */}
      <div data-testid="auth-content" className="flex flex-col gap-6">
        <ConnectionBanner />
        {children}
      </div>
    </main>
  );
}
