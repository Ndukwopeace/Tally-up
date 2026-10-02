/**
 * A list of phone numbers: one field per number, add and remove (Q-57i).
 *
 * WHY:  Depots and users may have several phone numbers, all optional. Each
 *       number gets its own labelled field and its own error, so a wrong one
 *       is easy to find (WCAG 3.3.1).
 * HOW:  A fieldset with a legend and hint; one TextField per row with
 *       inputMode "tel" (phone keypad); a Remove button per row when there is
 *       more than one; "Add another number" appends an empty row.
 * WHEN: Depot form (A2b) and user form (A2c).
 * SECURITY: Display only; numbers are checked by domain/phone.ts and again by the database.
 */
import { Plus, X } from "lucide-react";

import { TextField } from "./TextField";

import { Button } from "@/components/ui/button";
import { en } from "@/i18n/en";

export interface PhoneListFieldProps {
  /** Prefix for field ids, e.g. "depot-phone" → depot-phone-1, depot-phone-2. */
  idPrefix: string;
  values: string[];
  onValuesChange: (values: string[]) => void;
  /** Error message by row index. */
  errors?: Record<number, string>;
}

export function PhoneListField({
  idPrefix,
  values,
  onValuesChange,
  errors = {},
}: Readonly<PhoneListFieldProps>) {
  return (
    // min-w-0: a fieldset otherwise refuses to shrink and can widen the page.
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="text-base font-semibold text-ink">{en.phones.legend}</legend>
      <p className="text-sm text-ink-muted">{en.phones.hint}</p>
      {values.map((value, index) => (
        // Rows have no stable id; the index is the row's identity (rows are only added at the end or removed).
        <div key={index} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <TextField
              id={`${idPrefix}-${String(index + 1)}`}
              label={en.phones.label(index + 1)}
              type="text"
              inputMode="tel"
              autoComplete="tel"
              value={value}
              onValueChange={(next) => {
                onValuesChange(values.map((current, position) => (position === index ? next : current)));
              }}
              error={errors[index]}
            />
          </div>
          {values.length > 1 ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={en.phones.remove(index + 1)}
              onClick={() => {
                onValuesChange(values.filter((_, position) => position !== index));
              }}
              className={errors[index] ? "mb-7" : undefined}
            >
              <X aria-hidden="true" className="size-5" />
            </Button>
          ) : null}
        </div>
      ))}
      <Button
        variant="secondary"
        className="self-start"
        onClick={() => {
          onValuesChange([...values, ""]);
        }}
      >
        <Plus aria-hidden="true" className="size-5" />
        {en.phones.add}
      </Button>
    </fieldset>
  );
}
