/**
 * Admin → More → Users: every account with its role, depot and status (USR-01).
 *
 * WHY:  The admin needs to see who has an account, what role they have, which
 *       depot a manager runs, and whether the account is active, then open one
 *       or add a new one.
 * HOW:  Cards (phone-first, NFR-08) from useUsers, filtered by a search box on
 *       name or email. Each card opens the account's edit page. "Add user" is
 *       pinned above the bottom tabs (F-2). Loading, empty and error states per
 *       NFR-07; after a save the form returns here with a confirmation.
 * WHEN: /admin/users.
 * SECURITY: Read-only list; RLS lets only an active admin read every account (AUTH-10).
 */
import { ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FormMessage } from "@/components/common/FormMessage";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import { RecordStatusLabel } from "@/components/common/RecordStatusLabel";
import { TextField } from "@/components/common/TextField";
import { buttonVariants } from "@/components/ui/button";
import { useUsers } from "@/hooks/useUsers";
import { en } from "@/i18n/en";
import { PageTitle } from "@/pages/PageTitle";

// What the form passed along after saving: the name, and whether the account is new.
function savedNote(state: unknown): { name: string; created: boolean } | null {
  if (typeof state === "object" && state !== null && "saved" in state && typeof state.saved === "string") {
    return { name: state.saved, created: "created" in state && state.created === true };
  }
  return null;
}

export function UsersPage() {
  const { data: users, isPending, isError, refetch } = useUsers();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const saved = savedNote(location.state);

  let content;
  if (isPending) {
    content = <PageSkeleton />;
  } else if (isError) {
    content = (
      <ErrorState
        onRetry={() => {
          void refetch();
        }}
      />
    );
  } else if (users.length === 0) {
    content = <EmptyState title={en.users.emptyTitle} description={en.users.emptyBody} />;
  } else {
    // Case-insensitive match on name or email.
    const needle = query.trim().toLowerCase();
    const shown = users.filter(
      (user) => user.fullName.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle),
    );
    content = (
      <>
        <TextField id="user-search" label={en.users.search} value={query} onValueChange={setQuery} />
        {shown.length === 0 ? (
          <p className="text-base text-ink-muted">{en.users.noMatch(query.trim())}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((user) => (
              <li key={user.id}>
                <Link
                  to={`/admin/users/${user.id}/edit`}
                  className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-3 shadow-sm hover:border-brand active:bg-canvas"
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-lg font-semibold break-words text-ink">{user.fullName}</span>
                    <span className="text-sm break-words text-ink-muted">{user.email}</span>
                    <span className="text-sm text-ink">
                      {en.roles[user.role]}
                      {user.depot ? ` · ${en.users.runs(user.depot.name)}` : ""}
                    </span>
                    <RecordStatusLabel status={user.status} />
                  </span>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <>
      <PageTitle title={en.nav.users} />
      <div className="flex flex-col gap-4">
        {saved ? (
          <FormMessage tone="success">
            {saved.created ? en.users.created(saved.name) : en.users.saved(saved.name)}
          </FormMessage>
        ) : null}
        {content}
      </div>
      {/* F-2: the main action stays in reach above the bottom tabs. */}
      <div className="sticky bottom-24 mt-6">
        <Link to="/admin/users/new" className={buttonVariants({ size: "block" })}>
          <Plus aria-hidden="true" className="size-5" />
          {en.users.add}
        </Link>
      </div>
    </>
  );
}
