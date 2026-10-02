/**
 * Admin → More → Depots: every depot with its location, manager and status (DEP-01 to DEP-03).
 *
 * WHY:  The admin needs to see each depot, who runs it, and whether it is
 *       active, then open one or add a new one (wireframe "Depots List",
 *       review W-B6: show the manager).
 * HOW:  Cards (phone-first, NFR-08) from useDepots, filtered by a search box on
 *       name or location. Each card opens the depot's detail page. "Add depot"
 *       is pinned above the bottom tabs (F-2). Loading, empty and error states
 *       per NFR-07; after a save the form returns here with "… was saved.".
 * WHEN: /admin/depots.
 * SECURITY: Read-only list; RLS decides what an admin reads.
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
import { useDepots } from "@/hooks/useDepots";
import { en } from "@/i18n/en";
import { PageTitle } from "@/pages/PageTitle";

// The name of the depot just saved, passed by the form in the location state.
function savedName(state: unknown): string | null {
  if (typeof state === "object" && state !== null && "saved" in state && typeof state.saved === "string") {
    return state.saved;
  }
  return null;
}

export function DepotsPage() {
  const { data: depots, isPending, isError, refetch } = useDepots();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const saved = savedName(location.state);

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
  } else if (depots.length === 0) {
    content = <EmptyState title={en.depots.emptyTitle} description={en.depots.emptyBody} />;
  } else {
    // Case-insensitive match on name or location.
    const needle = query.trim().toLowerCase();
    const shown = depots.filter(
      (depot) => depot.name.toLowerCase().includes(needle) || depot.location.toLowerCase().includes(needle),
    );
    content = (
      <>
        <TextField id="depot-search" label={en.depots.search} value={query} onValueChange={setQuery} />
        {shown.length === 0 ? (
          <p className="text-base text-ink-muted">{en.depots.noMatch(query.trim())}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((depot) => (
              <li key={depot.id}>
                <Link
                  to={`/admin/depots/${depot.id}`}
                  className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-3 shadow-sm hover:border-brand active:bg-canvas"
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-lg font-semibold break-words text-ink">{depot.name}</span>
                    <span className="text-sm text-ink-muted">{depot.location}</span>
                    <span className="text-sm text-ink">
                      {en.depots.manager}: {depot.manager?.fullName ?? en.depots.noManager}
                    </span>
                    <RecordStatusLabel status={depot.status} />
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
      <PageTitle title={en.nav.depots} />
      <div className="flex flex-col gap-4">
        {saved ? <FormMessage tone="success">{en.depots.saved(saved)}</FormMessage> : null}
        {content}
      </div>
      {/* F-2: the main action stays in reach above the bottom tabs. */}
      <div className="sticky bottom-24 mt-6">
        <Link to="/admin/depots/new" className={buttonVariants({ size: "block" })}>
          <Plus aria-hidden="true" className="size-5" />
          {en.depots.add}
        </Link>
      </div>
    </>
  );
}
