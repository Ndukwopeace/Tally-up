/**
 * Admin → Products → Add / Edit product (PRD-01 to PRD-06, Q-57d/h, wireframe review W-B3).
 *
 * WHY:  The admin defines each bread once: name, code, description, whether
 *       it is sold in Packs and Caisses and how many loaves each holds, and
 *       whether it is active. Every later quantity depends on these values.
 * HOW:  /admin/products/new shows an empty form; /admin/products/:productId
 *       loads the product first (skeleton, error, not found). The form:
 *       - Loaf is always on (Q-57d) and shown as fixed.
 *       - "Sold in Packs" reveals "Loaves in one Pack".
 *       - "Sold in Caisses" reveals a choice to count the Caisse in loaves or
 *         in packs (PRD-05) and shows the result live: "1 Caisse = 50 loaves".
 *       Checks run on save (domain/products.ts); the first wrong field gets
 *       focus. Saving shows "Saving…", is blocked offline, and returns to the
 *       list with "… was saved.".
 * WHEN: From the Products list.
 * SECURITY: The database function checks every rule again and refuses
 *       non-admins (admin_save_product). Messages are plain words, never raw
 *       server text.
 */
import { useRef, useState, type SubmitEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { CheckboxField } from "@/components/common/CheckboxField";
import { ErrorState } from "@/components/common/ErrorState";
import { FormMessage } from "@/components/common/FormMessage";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import { QuantityInput } from "@/components/common/QuantityInput";
import { SubmitButton } from "@/components/common/SubmitButton";
import { TextField } from "@/components/common/TextField";
import { buttonVariants } from "@/components/ui/button";
import {
  caisseLoaves,
  emptyProductForm,
  productFormFrom,
  validateProductForm,
  type CaisseMode,
  type ProductFormErrors,
  type ProductFormValues,
} from "@/domain/products";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useProduct, useSaveProduct } from "@/hooks/useProducts";
import { en } from "@/i18n/en";
import { PageTitle } from "@/pages/PageTitle";

/** /admin/products/new */
export function NewProductPage() {
  return <ProductForm title={en.products.newTitle} initial={emptyProductForm()} />;
}

/** /admin/products/:productId */
export function EditProductPage() {
  const { productId = "" } = useParams();
  const { data: product, isPending, isError, refetch } = useProduct(productId);

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
  if (product === null) {
    return (
      <>
        <PageTitle title={en.products.notFoundTitle} subtitle={en.products.notFoundBody} />
        <Link to="/admin/products" className={buttonVariants({ variant: "secondary" })}>
          {en.products.backToList}
        </Link>
      </>
    );
  }
  // `key`: a different product gets a fresh form.
  return (
    <ProductForm
      key={product.id}
      title={en.products.editTitle}
      initial={productFormFrom(product)}
      id={product.id}
    />
  );
}

// Field ids, also used to move focus to the first error.
const FIELD_IDS = {
  name: "product-name",
  code: "product-code",
  description: "product-description",
  packLoaves: "product-pack-loaves",
  caisseCount: "product-caisse-count",
} as const;

function ProductForm({
  title,
  initial,
  id,
}: Readonly<{ title: string; initial: ProductFormValues; id?: string }>) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const save = useSaveProduct();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const formRef = useRef<HTMLFormElement>(null);

  // Updates one part of the form.
  function update(patch: Partial<ProductFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateProductForm(values);
    setErrors(result.errors);
    if (!result.input) {
      // WCAG 3.3.1: focus the first field that needs fixing, in form order.
      const first = (Object.keys(FIELD_IDS) as (keyof typeof FIELD_IDS)[]).find((key) => result.errors[key]);
      if (first) {
        formRef.current?.querySelector<HTMLElement>(`#${FIELD_IDS[first]}`)?.focus();
      }
      return;
    }
    const input = result.input;
    save.mutate(
      { input, id },
      {
        onSuccess: () => {
          void navigate("/admin/products", { state: { saved: input.name } });
        },
      },
    );
  }

  const fieldError = (key: keyof ProductFormErrors) => {
    const code = errors[key];
    return code ? en.products.fieldErrors[code] : undefined;
  };
  const total = caisseLoaves(values);
  // A code clash belongs to the code field as well as the form message.
  const codeError =
    fieldError("code") ?? (save.error?.code === "code_taken" ? en.products.errors.code_taken : undefined);

  return (
    <>
      <PageTitle title={title} />
      <form ref={formRef} noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        {save.error ? <FormMessage tone="error">{en.products.errors[save.error.code]}</FormMessage> : null}

        <TextField
          id={FIELD_IDS.name}
          label={en.products.name}
          value={values.name}
          onValueChange={(name) => {
            update({ name });
          }}
          error={fieldError("name")}
        />
        <TextField
          id={FIELD_IDS.code}
          label={en.products.code}
          hint={en.products.codeHint}
          value={values.code}
          onValueChange={(code) => {
            update({ code });
          }}
          error={codeError}
        />
        <TextField
          id={FIELD_IDS.description}
          label={en.products.description}
          value={values.description}
          onValueChange={(description) => {
            update({ description });
          }}
          error={fieldError("description")}
        />

        {/* min-w-0: a fieldset otherwise refuses to shrink below its content and
            would push the page wider than the phone screen. */}
        <fieldset className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-4">
          <legend className="px-1 text-base font-semibold text-ink">{en.products.unitsLegend}</legend>
          {/* RULE Q-57d: Loaf is always a unit, worth one loaf. */}
          <p className="text-base text-ink">{en.products.loafAlways}</p>

          <CheckboxField
            label={en.products.packOn}
            checked={values.pack.on}
            onCheckedChange={(on) => {
              update({ pack: { ...values.pack, on } });
            }}
          />
          {values.pack.on ? (
            <QuantityInput
              id={FIELD_IDS.packLoaves}
              label={en.products.packLoaves}
              unit={en.units.Loaf.many}
              value={values.pack.loaves}
              onValueChange={(loaves) => {
                update({ pack: { ...values.pack, loaves } });
              }}
              error={fieldError("packLoaves")}
            />
          ) : null}

          <CheckboxField
            label={en.products.caisseOn}
            checked={values.caisse.on}
            onCheckedChange={(on) => {
              update({ caisse: { ...values.caisse, on } });
            }}
          />
          {values.caisse.on ? (
            <>
              {/* RULE PRD-05: one Caisse may be counted in loaves or in packs. */}
              <fieldset className="flex min-w-0 flex-col gap-1">
                <legend className="text-base font-semibold text-ink">{en.products.caisseMode}</legend>
                {(["loaves", "packs"] as const satisfies readonly CaisseMode[]).map((mode) => (
                  <label
                    key={mode}
                    className="flex min-h-12 cursor-pointer items-center gap-3 text-base text-ink"
                  >
                    <input
                      type="radio"
                      name="caisse-mode"
                      checked={values.caisse.mode === mode}
                      onChange={() => {
                        update({ caisse: { ...values.caisse, mode } });
                      }}
                      className="size-6 accent-brand"
                    />
                    {mode === "loaves" ? en.units.Loaf.many : en.units.Pack.many}
                  </label>
                ))}
              </fieldset>
              <QuantityInput
                id={FIELD_IDS.caisseCount}
                label={
                  values.caisse.mode === "loaves"
                    ? en.products.caisseCountLoaves
                    : en.products.caisseCountPacks
                }
                unit={values.caisse.mode === "loaves" ? en.units.Loaf.many : en.units.Pack.many}
                value={values.caisse.count}
                onValueChange={(count) => {
                  update({ caisse: { ...values.caisse, count } });
                }}
                error={fieldError("caisseCount")}
              />
              {/* Live result so the admin sees what will be stored (PRD-05). */}
              {total === null ? null : (
                <p aria-live="polite" className="text-base font-semibold text-ink">
                  {en.products.caisseTotal(total)}
                </p>
              )}
            </>
          ) : null}
        </fieldset>

        <CheckboxField
          label={en.products.activeLabel}
          hint={en.products.activeHint}
          checked={values.active}
          onCheckedChange={(active) => {
            update({ active });
          }}
        />

        <SubmitButton pending={save.isPending} disabled={!online} disabledReason={en.auth.offline}>
          {en.products.save}
        </SubmitButton>
      </form>
    </>
  );
}
