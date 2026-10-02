/**
 * Joins CSS class names and resolves Tailwind conflicts.
 *
 * WHY:  Components accept extra classes from callers. Without merging, a caller's
 *       "min-h-14" and the default "min-h-12" would both apply unpredictably.
 * HOW:  clsx drops false/empty values; tailwind-merge keeps the last of any
 *       conflicting Tailwind utilities.
 * WHEN: Inside any component that combines its own classes with caller classes.
 * SECURITY: Class names only; no user input should ever be passed here.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
