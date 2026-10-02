/**
 * A message about a whole form: why it was refused, or that it worked.
 *
 * WHY:  Errors that are not about one field (wrong password, account inactive,
 *       no connection) still need to be seen and heard at once (N9, WCAG 4.1.3).
 *       Success needs the same clarity (N1).
 * HOW:  "error" renders an alert region (announced immediately); "success" an
 *       <output> element (a polite status region). Icon + text + colour, never colour alone (WCAG 1.4.1).
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
  const isError = tone === "error";
  const Icon = isError ? CircleAlert : CircleCheck;
  const className = cn(
    "flex items-start gap-3 rounded-card border px-4 py-3 text-base text-ink",
    isError ? "border-danger/40 bg-danger-soft" : "border-success/40 bg-success-soft",
  );
  const content = (
    <>
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 size-5 shrink-0", isError ? "text-danger" : "text-success")}
      />
      <p>{children}</p>
    </>
  );
  // Errors: an alert region, announced at once. Success: <output>, the native element
  // with the "status" role, which every browser and screen reader understands.
  return isError ? (
    <div role="alert" className={className}>
      {content}
    </div>
  ) : (
    <output className={className}>{content}</output>
  );
}
