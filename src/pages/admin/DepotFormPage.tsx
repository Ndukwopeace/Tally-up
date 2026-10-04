/**
 * Admin → Depots → Add / Edit depot (DEP-01 to DEP-03, Q-57c, Q-57i).
 *
 * WHY:  The admin records each depot once: name, location, address, phone
 *       numbers, its manager, and whether it is active.
 * HOW:  /admin/depots/new shows an empty form; /admin/depots/:depotId/edit
 *       loads the depot first (skeleton, error, not found). The manager list
 *       comes from the depot manager accounts; each option says where that
 *       person works now. Before saving, the form says in words what will
 *       happen to other people: the current manager will be deactivated
 *       (Q-57c), or the chosen manager will leave another depot. Checks run on
 *       save (domain/depots.ts); the first wrong field gets focus. Saving shows
 *       "Saving…", is blocked offline, and returns to the list with "… was saved.".
 * WHEN: From the Depots list ("Add depot") and a depot's page ("Edit depot").
 * SECURITY: admin_save_depot checks every rule again and refuses non-admins.
 *       Messages are plain words, never raw server text.
 */
import { useRef, useState, type SubmitEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { CheckboxField } from "@/components/common/CheckboxField";
import { ErrorState } from "@/components/common/ErrorState";
import { FormMessage } from "@/components/common/FormMessage";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import { PhoneListField } from "@/components/common/PhoneListField";
import { SelectField, type SelectOption } from "@/components/common/SelectField";
import { SubmitButton } from "@/components/common/SubmitButton";
import { TextField } from "@/components/common/TextField";
import { WarningNote } from "@/components/common/WarningNote";
import { buttonVariants } from "@/components/ui/button";
import {
  depotFormFrom,
  emptyDepotForm,
  managerLosingDepot,
  replacedManager,
  validateDepotForm,
  type DepotFormErrors,
  type DepotFormValues,
} from "@/domain/depots";
import { useDepot, useDepotManagers, useDepots, useSaveDepot } from "@/hooks/useDepots";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { en } from "@/i18n/en";
import { PageTitle } from "@/pages/PageTitle";
import type { Depot, ManagerOption } from "@/types/entities";

/** /admin/depots/new */
export function NewDepotPage() {
  return <DepotForm title={en.depots.newTitle} initial={emptyDepotForm()} />;
}

/** /admin/depots/:depotId/edit */
export function EditDepotPage() {
  const { depotId = "" } = useParams();
  const { data: depot, isPending, isError, refetch } = useDepot(depotId);

  if (isPending) {
    return <PageSkeleton />;
  }
  if (isError) {
    return (
      <ErrorState
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }
  if (depot === null) {
    return (
      <>
        <PageTitle title={en.depots.notFoundTitle} subtitle={en.depots.notFoundBody} />
        <Link to="/admin/depots" className={buttonVariants({ variant: "secondary" })}>
          {en.depots.backToList}
        </Link>
      </>
    );
  }
  // `key`: a different depot gets a fresh form.
  return (
    <DepotForm key={depot.id} title={en.depots.editTitle} initial={depotFormFrom(depot)} depot={depot} />
  );
}

// Field ids, in form order, also used to move focus to the first error.
const FIELD_IDS = {
  name: "depot-name",
  location: "depot-location",
  address: "depot-address",
} as const;
const PHONE_PREFIX = "depot-phone";
const NO_MANAGER = "";

// Where a manager works now, as shown in the list: "runs this depot", "runs Akwa", "no depot".
function managerWhere(
  manager: ManagerOption,
  depot: Depot | undefined,
  depotNames: Map<string, string>,
): string {
  if (manager.status === "inactive") {
    return en.depots.managerInactive;
  }
  if (manager.depotId === null) {
    return en.depots.managerFree;
  }
  if (manager.depotId === depot?.id) {
    return en.depots.managerRunsHere;
  }
  return en.depots.managerRunsOther(depotNames.get(manager.depotId) ?? "");
}

/** The manager list with the warnings about whom a choice affects (DEP-03, Q-57c), or, for an inactive depot, why there is none (Q-58c). */
function ManagerSection({
  values,
  depot,
  onManagerChange,
}: Readonly<{
  values: DepotFormValues;
  depot?: Depot;
  onManagerChange: (managerId: string | null) => void;
}>) {
  const managers = useDepotManagers();
  const depots = useDepots();

  // RULE Q-58c: an inactive depot has no manager; say whose account this will deactivate.
  if (!values.active) {
    const closing = managerLosingDepot(depot, false);
    return (
      <div aria-live="polite" className="flex flex-col gap-2">
        <p className="text-base text-ink-muted">{en.depots.inactiveNoManager}</p>
        {closing ? <WarningNote>{en.depots.replaceWarning(closing.fullName)}</WarningNote> : null}
      </div>
    );
  }
  if (managers.isPending) {
    return <PageSkeleton />;
  }

  const managerList = managers.data ?? [];
  const depotNames = new Map((depots.data ?? []).map((saved) => [saved.id, saved.name]));
  // RULE DEP-03: a depot that has a manager keeps one; "No manager" is offered only when it has none.
  const options: SelectOption[] = [
    ...(depot?.manager ? [] : [{ value: NO_MANAGER, label: en.depots.managerNone }]),
    ...managerList.map((manager) => ({
      value: manager.id,
      label: en.depots.managerOption(manager.fullName, managerWhere(manager, depot, depotNames)),
    })),
  ];
  const replaced = replacedManager(depot, values.managerId);
  const chosen = managerList.find((manager) => manager.id === values.managerId);
  // The chosen manager runs another depot: that depot will be left without a manager.
  const leaves =
    chosen?.status === "active" && chosen.depotId !== null && chosen.depotId !== depot?.id
      ? depotNames.get(chosen.depotId)
      : undefined;

  return (
    <div className="flex flex-col gap-3">
      <SelectField
        id="depot-manager"
        label={en.depots.manager}
        hint={managerList.length === 0 ? en.depots.noManagersYet : en.depots.managerHint}
        value={values.managerId ?? NO_MANAGER}
        options={options}
        onValueChange={(managerId) => {
          onManagerChange(managerId === NO_MANAGER ? null : managerId);
        }}
      />
      {/* RULE Q-57c: say who loses access before the admin saves. The live
          region stays mounted so a new warning is read out when it appears. */}
      <div aria-live="polite" className="flex flex-col gap-2 empty:hidden">
        {replaced ? <WarningNote>{en.depots.replaceWarning(replaced.fullName)}</WarningNote> : null}
        {chosen && leaves !== undefined ? (
          <WarningNote>{en.depots.moveWarning(chosen.fullName, leaves)}</WarningNote>
        ) : null}
      </div>
    </div>
  );
}

function DepotForm({
  title,
  initial,
  depot,
}: Readonly<{ title: string; initial: DepotFormValues; depot?: Depot }>) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<DepotFormErrors>({});
  const save = useSaveDepot();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const formRef = useRef<HTMLFormElement>(null);

  function update(patch: Partial<DepotFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateDepotForm(values);
    setErrors(result.errors);
    if (!result.input) {
      // WCAG 3.3.1: focus the first field that needs fixing, in form order.
      const first = (Object.keys(FIELD_IDS) as (keyof typeof FIELD_IDS)[]).find((key) => result.errors[key]);
      const firstPhone = Object.keys(result.errors.phones ?? {})[0];
      let target: string | undefined;
      if (first) {
        target = FIELD_IDS[first];
      } else if (firstPhone !== undefined) {
        target = `${PHONE_PREFIX}-${String(Number(firstPhone) + 1)}`;
      }
      if (target) {
        formRef.current?.querySelector<HTMLElement>(`#${target}`)?.focus();
      }
      return;
    }
    const input = result.input;
    save.mutate(
      { input, id: depot?.id },
      {
        onSuccess: () => {
          void navigate("/admin/depots", { state: { saved: input.name } });
        },
      },
    );
  }

  const fieldError = (key: "name" | "location" | "address") => {
    const code = errors[key];
    return code ? en.depots.fieldErrors[code] : undefined;
  };
  const phoneErrors = Object.fromEntries(
    Object.entries(errors.phones ?? {}).map(([index, code]) => [index, en.depots.fieldErrors[code]]),
  );

  return (
    <>
      <PageTitle title={title} />
      <form ref={formRef} noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        {save.error ? <FormMessage tone="error">{en.depots.errors[save.error.code]}</FormMessage> : null}

        <TextField
          id={FIELD_IDS.name}
          label={en.depots.name}
          value={values.name}
          onValueChange={(name) => {
            update({ name });
          }}
          error={fieldError("name")}
        />
        <TextField
          id={FIELD_IDS.location}
          label={en.depots.location}
          value={values.location}
          onValueChange={(location) => {
            update({ location });
          }}
          error={fieldError("location")}
        />
        <TextField
          id={FIELD_IDS.address}
          label={en.depots.address}
          value={values.address}
          onValueChange={(address) => {
            update({ address });
          }}
          error={fieldError("address")}
        />

        <PhoneListField
          idPrefix={PHONE_PREFIX}
          values={values.phones}
          onValuesChange={(phones) => {
            update({ phones });
          }}
          errors={phoneErrors}
        />

        <ManagerSection
          values={values}
          depot={depot}
          onManagerChange={(managerId) => {
            update({ managerId });
          }}
        />

        <CheckboxField
          label={en.depots.activeLabel}
          hint={en.depots.activeHint}
          checked={values.active}
          onCheckedChange={(active) => {
            update({ active });
          }}
        />

        <SubmitButton pending={save.isPending} disabled={!online} disabledReason={en.auth.offline}>
          {en.depots.save}
        </SubmitButton>
      </form>
    </>
  );
}
