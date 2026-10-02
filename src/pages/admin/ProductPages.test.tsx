/**
 * Tests for Admin → Products (list, add, edit).
 *
 * Rules under test:
 *  - PRD-01: create, edit, activate/deactivate; no delete.
 *  - PRD-02 / Q-57h: name and code required; code format and uniqueness. Q-57j: description optional.
 *  - PRD-03 / Q-57d: Loaf always; Pack and Caisse optional.
 *  - PRD-04 / PRD-05: loaves per unit required; Caisse in loaves or packs, stored in loaves.
 *  - NFR-07: loading, empty, error states. NFR-06: no saving offline.
 *  - Q-56: Back stays inside the tab; saving shows progress.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderRoutes } from "../../../tests/helpers/renderRoutes";

import { MOCK_USERS } from "@/services/mock/MockAuthService";
import { MockProductService } from "@/services/mock/MockProductService";
import type { Product } from "@/types/entities";

const admin = MOCK_USERS.admin.id;

const BIG: Product = {
  id: "p-big",
  name: "Big Bread",
  code: "BB-01",
  description: "Large white loaf",
  status: "active",
  packLoaves: 10,
  caisseLoaves: 50,
};
const MILK: Product = {
  id: "p-milk",
  name: "Milk Bread",
  code: "MB-02",
  description: "Soft milk loaf",
  status: "inactive",
  packLoaves: null,
  caisseLoaves: null,
};

afterEach(() => {
  vi.restoreAllMocks();
});

function renderProducts(
  path: string,
  products = new MockProductService([BIG, MILK]),
  history: string[] = [],
) {
  return renderRoutes(path, { signedInAs: admin, products, history });
}

describe("Products list", () => {
  it("lists each product with its code, units in loaves and status", async () => {
    renderProducts("/admin/products");
    const big = await screen.findByRole("link", { name: /Big Bread/ });
    expect(big).toHaveTextContent("BB-01");
    expect(big).toHaveTextContent("Loaf · Pack = 10 loaves · Caisse = 50 loaves");
    expect(big).toHaveTextContent("Active");
    expect(big).toHaveAttribute("href", "/admin/products/p-big");
    expect(screen.getByRole("link", { name: /Milk Bread/ })).toHaveTextContent("Inactive");
  });

  it("filters by name or code, ignoring case", async () => {
    renderProducts("/admin/products");
    const search = await screen.findByLabelText("Search by name or code");
    await userEvent.type(search, "mb-");
    expect(screen.queryByRole("link", { name: /Big Bread/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Milk Bread/ })).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, "croissant");
    expect(screen.getByText('No product matches "croissant".')).toBeInTheDocument();
  });

  it("shows an empty state with the Add button still available", async () => {
    renderProducts("/admin/products", new MockProductService());
    expect(await screen.findByRole("heading", { name: "No products yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add product" })).toHaveAttribute("href", "/admin/products/new");
  });

  it("shows a skeleton while loading, and Try again on failure", async () => {
    const products = new MockProductService([BIG]);
    products.failNextCallWith("unavailable");
    renderProducts("/admin/products", products);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: /Big Bread/ })).toBeInTheDocument();
  });

  it("Q-56: Back goes to More, inside the same tab", async () => {
    const { router } = renderProducts("/admin/products");
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/admin/more");
  });
});

describe("Add product", () => {
  async function openNew(products = new MockProductService([BIG])) {
    const view = renderProducts("/admin/products/new", products, ["/admin/products"]);
    await screen.findByRole("heading", { level: 1, name: "New product" });
    return view;
  }

  it("Q-57d: shows Loaf as always available", async () => {
    await openNew();
    expect(screen.getByText("Loaf: always available, 1 loaf")).toBeInTheDocument();
  });

  it("explains every missing field and focuses the first", async () => {
    await openNew();
    await userEvent.click(screen.getByRole("button", { name: "Save product" }));
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("Enter the product name.");
    expect(screen.getByLabelText("Code")).toHaveAccessibleDescription(
      "Letters, numbers and dashes, up to 20. For example BB-01. Enter a product code.",
    );
    // Q-57j: description is optional, so it never shows an error.
    expect(screen.getByLabelText(/Description/)).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });

  it("PRD-05: Caisse counted in packs shows and saves the loaves (5 × 10 = 50)", async () => {
    const products = new MockProductService();
    const { router } = await openNew(products);
    await userEvent.type(screen.getByLabelText("Name"), "Small Bread");
    await userEvent.type(screen.getByLabelText("Code"), "SB-1");
    await userEvent.type(screen.getByLabelText(/Description/), "Small loaf");
    await userEvent.click(screen.getByLabelText("Sold in Packs"));
    await userEvent.type(screen.getByLabelText(/Loaves in one Pack/), "10");
    await userEvent.click(screen.getByLabelText("Sold in Caisses"));
    await userEvent.click(screen.getByLabelText("Packs"));
    await userEvent.type(screen.getByLabelText(/Packs in one Caisse/), "5");
    expect(screen.getByText("1 Caisse = 50 loaves")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save product" }));
    expect(await screen.findByText("Small Bread was saved.")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin/products");
    expect((await products.list())[0]).toMatchObject({
      name: "Small Bread",
      code: "SB-1",
      status: "active",
      packLoaves: 10,
      caisseLoaves: 50,
    });
    expect(await screen.findByRole("link", { name: /Small Bread/ })).toHaveTextContent("Caisse = 50 loaves");
  });

  it("asks for Pack first when the Caisse is counted in packs", async () => {
    await openNew();
    await userEvent.click(screen.getByLabelText("Sold in Caisses"));
    await userEvent.click(screen.getByLabelText("Packs"));
    await userEvent.type(screen.getByLabelText(/Packs in one Caisse/), "5");
    await userEvent.click(screen.getByRole("button", { name: "Save product" }));
    expect(screen.getByLabelText(/Packs in one Caisse/)).toHaveAccessibleDescription(
      "Switch on Packs and set loaves per Pack first, or count the Caisse in loaves.",
    );
  });

  it("Q-57h: refuses a code another product uses, on the field and above the form", async () => {
    await openNew();
    await userEvent.type(screen.getByLabelText("Name"), "Copy");
    await userEvent.type(screen.getByLabelText("Code"), "bb-01");
    await userEvent.type(screen.getByLabelText(/Description/), "x");
    await userEvent.click(screen.getByRole("button", { name: "Save product" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Another product already uses this code.");
    expect(screen.getByLabelText("Code")).toHaveAttribute("aria-invalid", "true");
  });

  it("Q-56: shows Saving… while it saves", async () => {
    const products = new MockProductService();
    await openNew(products);
    await userEvent.type(screen.getByLabelText("Name"), "Bun");
    await userEvent.type(screen.getByLabelText("Code"), "BU-1");
    await userEvent.type(screen.getByLabelText(/Description/), "Bun");
    const release = products.holdNextCall();
    await userEvent.click(screen.getByRole("button", { name: "Save product" }));
    expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
    release();
    expect(await screen.findByText("Bun was saved.")).toBeInTheDocument();
  });

  it("NFR-06: cannot save offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await openNew();
    expect(screen.getByRole("button", { name: "Save product" })).toBeDisabled();
  });

  it("Q-56: Back returns to the products list", async () => {
    const { router } = await openNew();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/admin/products");
  });
});

describe("Edit product", () => {
  it("fills the form, and PRD-01: deactivating keeps the product in the list as Inactive", async () => {
    const products = new MockProductService([BIG]);
    renderProducts("/admin/products/p-big", products, ["/admin/products"]);
    expect(await screen.findByRole("heading", { level: 1, name: "Edit product" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Big Bread");
    expect(screen.getByLabelText("Sold in Packs")).toBeChecked();
    expect(screen.getByLabelText(/Loaves in one Pack/)).toHaveValue("10");
    expect(screen.getByLabelText(/Loaves in one Caisse/)).toHaveValue("50");
    expect(screen.getByText("1 Caisse = 50 loaves")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Active"));
    await userEvent.click(screen.getByLabelText("Sold in Caisses"));
    await userEvent.click(screen.getByRole("button", { name: "Save product" }));

    const card = await screen.findByRole("link", { name: /Big Bread/ });
    expect(card).toHaveTextContent("Inactive");
    expect(within(card).queryByText(/Caisse/)).not.toBeInTheDocument();
    expect(await products.get("p-big")).toMatchObject({
      status: "inactive",
      caisseLoaves: null,
      packLoaves: 10,
    });
  });

  it("says when the product does not exist", async () => {
    renderProducts("/admin/products/missing");
    expect(await screen.findByRole("heading", { level: 1, name: "Product not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to products" })).toHaveAttribute("href", "/admin/products");
  });

  it("offers Try again when the product cannot be loaded", async () => {
    const products = new MockProductService([BIG]);
    products.failNextCallWith("unavailable");
    renderProducts("/admin/products/p-big", products);
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Edit product" })).toBeInTheDocument();
  });

  it("explains a refused save in plain words", async () => {
    const products = new MockProductService([BIG]);
    renderProducts("/admin/products/p-big", products);
    await screen.findByRole("heading", { level: 1, name: "Edit product" });
    products.failNextCallWith("not_admin");
    await userEvent.click(screen.getByRole("button", { name: "Save product" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only an active admin can change products.");
  });
});
