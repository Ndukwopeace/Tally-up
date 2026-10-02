/**
 * The base button used everywhere in Tally-Up (shadcn/ui pattern).
 *
 * WHY:  One button style per role keeps actions recognisable (N4, UI_GUIDELINES §3
 *       signifiers): primary = filled blue, secondary = outlined, ghost = text-like,
 *       danger = red for destructive actions only.
 * HOW:  class-variance-authority maps `variant` and `size` to Tailwind classes.
 *       Every size is at least 48px tall (F-1) with a visible focus ring (WCAG 2.4.7).
 * WHEN: Directly for actions, and wrapped by SubmitButton for form submits.
 * SECURITY: Defaults to type="button", so a button inside a form never submits
 *       it by accident; only SubmitButton submits.
 */
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

const buttonVariants = cva(
  // Shared: 48px minimum height (F-1), centred icon + text, disabled look, focus ring from index.css.
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white hover:bg-brand-hover",
        secondary: "border-2 border-brand bg-surface text-brand hover:bg-brand-soft",
        ghost: "text-brand hover:bg-brand-soft",
        danger: "bg-danger text-white hover:bg-danger-hover",
      },
      size: {
        md: "",
        // F-2: full-width primary action pinned at the bottom of mobile screens.
        block: "w-full",
        // Square icon-only button; the caller must give it an aria-label.
        icon: "w-12 px-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
