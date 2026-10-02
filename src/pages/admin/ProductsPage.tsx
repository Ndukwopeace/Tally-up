/**
 * Admin → More → Products: every product with its units (PRD-01 to PRD-04).
 *
 * WHY:  The admin needs to see each bread, its code, how many loaves its Pack
 *       and Caisse hold, and whether it is active, then add or edit one.
 * HOW:  Cards (phone-first, NFR-08) from useProducts, filtered by a search box
 *       on name or code. Each card opens the product's form. "Add product" is
 *       pinned above the bottom tabs, in thumb reach (F-2). Loading, empty and
 *       error states per NFR-07. After a save, the form returns here with a
 *       "… was saved." message (N1).
 * WHEN: /admin/products.
 * SECURITY: Read-only list; the data is whatever RLS lets an admin read.
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
import { productUnits } from "@/domain/products";
import { useProducts } from "@/hooks/useProducts";
import { en } from "@/i18n/en";
import { PageTitle } from "@/pages/PageTitle";

// The name of the product just saved, passed by the form in the location state.
function savedName(state: unknown): string | null {
  if (typeof state === "object" && state !== null && "saved" in state && typeof state.saved === "string") {
    return state.saved;
  }
  return null;
}

export function ProductsPage() {
  const { data: products, isPending, isError, refetch } = useProducts();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const saved = savedName(location.state);

  const addButton = (
    <Link to="/admin/products/new" className={buttonVariants({ size: "block" })}>
      <Plus aria-hidden="true" className="size-5" />
      {en.products.add}
    </Link>
  );

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
  } else if (products.length === 0) {
    content = <EmptyState title={en.products.emptyTitle} description={en.products.emptyBody} />;
  } else {
    // Case-insensitive match on name or code.
    const needle = query.trim().toLowerCase();
    const shown = products.filter(
      (product) => product.name.toLowerCase().includes(needle) || product.code.toLowerCase().includes(needle),
    );
    content = (
      <>
        <TextField id="product-search" label={en.products.search} value={query} onValueChange={setQuery} />
        {shown.length === 0 ? (
          <p className="text-base text-ink-muted">{en.products.noMatch(query.trim())}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((product) => (
              <li key={product.id}>
                <Link
                  to={`/admin/products/${product.id}`}
                  className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-3 shadow-sm hover:border-brand active:bg-canvas"
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-lg font-semibold break-words text-ink">{product.name}</span>
                    <span className="text-sm text-ink-muted">{product.code}</span>
                    <span className="text-sm text-ink">
                      {productUnits(product)
                        .map(({ unit, loaves }) =>
                          unit === "Loaf"
                            ? en.units.Loaf.one
                            : en.products.unitLine(en.units[unit].one, loaves),
                        )
                        .join(" · ")}
                    </span>
                    <RecordStatusLabel status={product.status} />
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
      <PageTitle title={en.nav.products} />
      <div className="flex flex-col gap-4">
        {saved ? <FormMessage tone="success">{en.products.saved(saved)}</FormMessage> : null}
        {content}
      </div>
      {/* F-2: the main action stays in reach above the bottom tabs. */}
      <div className="sticky bottom-24 mt-6">{addButton}</div>
    </>
  );
}
