/**
 * A message about a whole form: why it was refused, or that it worked.
 *
 * WHY:  Errors that are not about one field (wrong password, account inactive,
 *       no connection) still need to be seen and heard at once (N9, WCAG 4.1.3).
 *       Success needs the same clarity (N1).
 * HOW:  "error" renders an alert region (announced immediately); "success" a
 *       polite status region. Icon + text + colour, never colour alone (WCAG 1.4.1).
 * WHEN: Above or below forms on the auth pages and Profile.
 * SECURITY: Shows only text from i18n/en.ts, never raw server messages.
 */
import { CircleAlert, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function FormMessage({
  tone,
  children,
}: Readonly<{ tone: "error" | "success"; children: ReactNode }>) {
  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-card border px-4 py-3 text-base text-ink",
        tone === "error" ? "border-danger/40 bg-danger-soft" : "border-success/40 bg-success-soft",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 size-5 shrink-0", tone === "error" ? "text-danger" : "text-success")}
      />
      <p>{children}</p>
    </div>
  );
}
