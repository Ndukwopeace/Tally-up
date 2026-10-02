/**
 * Admin → Users → Add / Edit user, and reset a password (USR-01 to USR-04, USR-06, Q-57a to Q-57c, Q-57f, Q-57g, Q-57i).
 *
 * WHY:  The admin creates every account (AUTH-02): name, email (the login),
 *       phone numbers, role, depot for a manager, whether it is active, and the
 *       temporary password they will pass on. Later they can change the email
 *       and role, deactivate the account, or set a new temporary password.
 * HOW:  /admin/users/new shows an empty form; /admin/users/:userId/edit loads
 *       the account first (skeleton, error, not found). The depot list appears
 *       only for an active depot manager (USR-03). Before saving, the form says
 *       in words whom a depot choice affects: the manager who will be
 *       deactivated, or the depot left without one (Q-57c, DEP-03). An admin
 *       cannot switch themselves off (Q-57f), and the only active admin cannot
 *       change role (USR-06): those controls are locked with the reason shown.
 *       Checks run on save (domain/users.ts); the first wrong field gets focus.
 *       Saving shows "Saving…", is blocked offline, and returns to the list.
 *       The edit page ends with "Reset password" (Q-57b): a separate form that
 *       sets a new temporary password.
 * WHEN: From the Users list ("Add user", or a user's card).
 * SECURITY: The server function and the database check every rule again and
 *       refuse non-admins. Messages are plain words, never raw server text. The
 *       password fields are cleared after use and never stored in the app.
 */
import { useRef, useState, type SubmitEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { useAuth } from "@/auth/useAuth";
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
import { validateNewPassword, type NewPasswordErrors } from "@/domain/validation";
import {
  depotConsequences,
  emptyUserForm,
  isLastActiveAdmin,
  userFormFrom,
  validateUserForm,
  type UserFormErrors,
  type UserFormValues,
} from "@/domain/users";
import { useDepots } from "@/hooks/useDepots";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useResetPassword, useSaveUser, useUser, useUsers } from "@/hooks/useUsers";
import { en } from "@/i18n/en";
import { PageTitle } from "@/pages/PageTitle";
import type { User } from "@/types/entities";
import { ROLES, type Role } from "@/types/enums";

/** /admin/users/new */
export function NewUserPage() {
  return <UserForm title={en.users.newTitle} initial={emptyUserForm()} />;
}

/** /admin/users/:userId/edit */
export function EditUserPage() {
  const { userId = "" } = useParams();
  const { data: user, isPending, isError, refetch } = useUser(userId);

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
  if (user === null) {
    return (
      <>
        <PageTitle title={en.users.notFoundTitle} subtitle={en.users.notFoundBody} />
        <Link to="/admin/users" className={buttonVariants({ variant: "secondary" })}>
          {en.users.backToList}
        </Link>
      </>
    );
  }
  // `key`: a different account gets a fresh form.
  return (
    <>
      <UserForm key={user.id} title={en.users.editTitle} initial={userFormFrom(user)} user={user} />
      <ResetPasswordSection key={`reset-${user.id}`} user={user} />
    </>
  );
}

// Field ids, in form order, also used to move focus to the first error.
const FIELD_IDS = {
  fullName: "user-name",
  email: "user-email",
  depot: "user-depot",
  password: "user-password",
  repeat: "user-repeat",
} as const;
const PHONE_PREFIX = "user-phone";
const NO_DEPOT = "";

// The ids of the fields with errors, in the order they appear on screen.
function errorOrder(errors: UserFormErrors): string[] {
  const ids: string[] = [];
  if (errors.fullName) {
    ids.push(FIELD_IDS.fullName);
  }
  if (errors.email) {
    ids.push(FIELD_IDS.email);
  }
  for (const index of Object.keys(errors.phones ?? {})) {
    ids.push(`${PHONE_PREFIX}-${String(Number(index) + 1)}`);
  }
  if (errors.depot) {
    ids.push(FIELD_IDS.depot);
  }
  if (errors.password) {
    ids.push(FIELD_IDS.password);
  }
  if (errors.repeat) {
    ids.push(FIELD_IDS.repeat);
  }
  return ids;
}

function UserForm({
  title,
  initial,
  user,
}: Readonly<{ title: string; initial: UserFormValues; user?: User }>) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<UserFormErrors>({});
  const save = useSaveUser();
  const depots = useDepots();
  const everyone = useUsers();
  const { state } = useAuth();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const formRef = useRef<HTMLFormElement>(null);
  const creating = user === undefined;

  function update(patch: Partial<UserFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateUserForm(values, { creating });
    setErrors(result.errors);
    if (!result.input) {
      // WCAG 3.3.1: focus the first field that needs fixing, in form order.
      const first = errorOrder(result.errors)[0];
      if (first) {
        formRef.current?.querySelector<HTMLElement>(`#${first}`)?.focus();
      }
      return;
    }
    const input = result.input;
    save.mutate(
      { input, id: user?.id, password: result.password },
      {
        onSuccess: () => {
          void navigate("/admin/users", { state: { saved: input.fullName, created: creating } });
        },
      },
    );
  }

  const phoneErrors = Object.fromEntries(
    Object.entries(errors.phones ?? {}).map(([index, code]) => [index, en.users.fieldErrors[code]]),
  );

  const depotList = depots.data ?? [];
  const showDepot = values.role === "depot_manager" && values.active;
  const depotOptions: SelectOption[] = [
    { value: NO_DEPOT, label: en.users.depotChoose },
    ...depotList.map((depot) => ({
      value: depot.id,
      label: en.users.depotOption(depot.name, depot.manager?.fullName ?? null),
    })),
  ];
  const { replaced, leaves } = depotConsequences(values, user, depotList);
  const chosenDepot = depotList.find((depot) => depot.id === values.depotId);

  // RULE USR-06 / Q-57f: an admin cannot switch themselves off; the only active admin keeps the role.
  const isSelf = state.status === "signed_in" && user !== undefined && state.account.id === user.id;
  const lastAdmin = user !== undefined && isLastActiveAdmin(everyone.data ?? [], user.id);
  const activeHint = isSelf ? `${en.users.activeHint} ${en.users.ownAccountHint}` : en.users.activeHint;

  return (
    <>
      <PageTitle title={title} />
      <form ref={formRef} noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        {save.error ? <FormMessage tone="error">{en.users.errors[save.error.code]}</FormMessage> : null}

        <TextField
          id={FIELD_IDS.fullName}
          label={en.users.fullName}
          autoComplete="name"
          value={values.fullName}
          onValueChange={(fullName) => {
            update({ fullName });
          }}
          error={errors.fullName ? en.users.fieldErrors[errors.fullName] : undefined}
        />
        <TextField
          id={FIELD_IDS.email}
          label={en.users.email}
          hint={en.users.emailHint}
          type="email"
          autoComplete="off"
          value={values.email}
          onValueChange={(email) => {
            update({ email });
          }}
          error={errors.email ? en.auth.fieldErrors[errors.email] : undefined}
        />

        <PhoneListField
          idPrefix={PHONE_PREFIX}
          values={values.phones}
          onValuesChange={(phones) => {
            update({ phones });
          }}
          errors={phoneErrors}
        />

        <SelectField
          id="user-role"
          label={en.users.role}
          value={values.role}
          options={ROLES.map((role) => ({ value: role, label: en.roles[role] }))}
          // RULE USR-06: the only active admin cannot be given another role.
          disabled={lastAdmin}
          hint={lastAdmin ? en.users.lastAdminHint : undefined}
          onValueChange={(role) => {
            update({ role: role as Role });
          }}
        />

        {showDepot ? (
          <SelectField
            id={FIELD_IDS.depot}
            label={en.users.depot}
            hint={errors.depot ? en.users.fieldErrors[errors.depot] : en.users.depotHint}
            value={values.depotId ?? NO_DEPOT}
            options={depotOptions}
            onValueChange={(depotId) => {
              update({ depotId: depotId === NO_DEPOT ? null : depotId });
            }}
          />
        ) : null}
        {/* RULE Q-57c / DEP-03: say who is affected before the admin saves. The live
            region stays mounted so a new warning is read out when it appears. */}
        <div aria-live="polite" className="flex flex-col gap-2 empty:hidden">
          {replaced && chosenDepot ? (
            <WarningNote>{en.users.replaceWarning(replaced.fullName, chosenDepot.name)}</WarningNote>
          ) : null}
          {leaves !== null && user ? (
            <WarningNote>{en.users.leaveWarning(user.fullName, leaves)}</WarningNote>
          ) : null}
        </div>

        <CheckboxField
          label={en.users.activeLabel}
          hint={activeHint}
          checked={values.active}
          // RULE USR-06 / Q-57f: an admin cannot deactivate their own account.
          disabled={isSelf}
          onCheckedChange={(active) => {
            update({ active });
          }}
        />

        {creating ? (
          <>
            <TextField
              id={FIELD_IDS.password}
              label={en.users.password}
              hint={en.users.passwordHint}
              type="password"
              autoComplete="new-password"
              value={values.password}
              onValueChange={(password) => {
                update({ password });
              }}
              error={errors.password ? en.auth.fieldErrors[errors.password] : undefined}
            />
            <TextField
              id={FIELD_IDS.repeat}
              label={en.users.repeatPassword}
              type="password"
              autoComplete="new-password"
              value={values.repeat}
              onValueChange={(repeat) => {
                update({ repeat });
              }}
              error={errors.repeat ? en.auth.fieldErrors[errors.repeat] : undefined}
            />
          </>
        ) : null}

        <SubmitButton pending={save.isPending} disabled={!online} disabledReason={en.auth.offline}>
          {creating ? en.users.create : en.users.save}
        </SubmitButton>
      </form>
    </>
  );
}

/** Q-57b: sets a new temporary password for this account. A form of its own, below the edit form. */
function ResetPasswordSection({ user }: Readonly<{ user: User }>) {
  const reset = useResetPassword();
  const online = useOnlineStatus();
  const passwordRef = useRef<HTMLInputElement>(null);
  const repeatRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<NewPasswordErrors>({});
  const [done, setDone] = useState(false);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setDone(false);
    const found = validateNewPassword({ password, repeat });
    setErrors(found);
    if (found.password) {
      passwordRef.current?.focus();
      return;
    }
    if (found.repeat) {
      repeatRef.current?.focus();
      return;
    }
    reset.mutate(
      { id: user.id, password },
      {
        onSuccess: () => {
          // Clear the fields so the password does not stay on screen.
          setPassword("");
          setRepeat("");
          setDone(true);
        },
      },
    );
  }

  return (
    <section aria-labelledby="reset-password" className="mt-10 flex flex-col gap-4">
      <h2 id="reset-password" className="text-lg font-semibold text-ink">
        {en.users.resetTitle}
      </h2>
      <p className="text-base text-ink-muted">{en.users.resetHint(user.fullName)}</p>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        {reset.error ? <FormMessage tone="error">{en.users.errors[reset.error.code]}</FormMessage> : null}
        {done ? <FormMessage tone="success">{en.users.resetDone(user.fullName)}</FormMessage> : null}
        <TextField
          ref={passwordRef}
          id="reset-password-new"
          label={en.users.password}
          type="password"
          autoComplete="new-password"
          value={password}
          onValueChange={setPassword}
          error={errors.password ? en.auth.fieldErrors[errors.password] : undefined}
        />
        <TextField
          ref={repeatRef}
          id="reset-password-repeat"
          label={en.users.repeatPassword}
          type="password"
          autoComplete="new-password"
          value={repeat}
          onValueChange={setRepeat}
          error={errors.repeat ? en.auth.fieldErrors[errors.repeat] : undefined}
        />
        <SubmitButton pending={reset.isPending} disabled={!online} disabledReason={en.auth.offline}>
          {en.users.resetSave}
        </SubmitButton>
      </form>
    </section>
  );
}
