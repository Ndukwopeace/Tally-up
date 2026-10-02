/**
 * Tests for Admin → Depots (list, detail, add, edit).
 *
 * Rules under test:
 *  - DEP-01: create, edit, activate/deactivate; no delete.
 *  - DEP-02: name, location and address required.
 *  - DEP-03 / Q-57c: one manager per depot; replacing a manager deactivates the old one.
 *  - Q-57i: phone numbers optional, several allowed, Cameroon format, stored as +237….
 *  - DEP-05: the depot page has a history section.
 *  - NFR-07: loading, empty, error states. NFR-06: no saving offline.
 *  - Q-56: Back stays inside the tab; saving shows progress.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderRoutes } from "../../../tests/helpers/renderRoutes";

import { MOCK_USERS } from "@/services/mock/MockAuthService";
import { MockDepotService } from "@/services/mock/MockDepotService";
import type { ManagerOption } from "@/types/entities";

const admin = MOCK_USERS.admin.id;

const AKWA = {
  id: "d-akwa",
  name: "Akwa",
  location: "Douala",
  address: "Near the market",
  phones: ["+237677123456"],
  status: "active" as const,
};
const BASTOS = {
  id: "d-bastos",
  name: "Bastos",
  location: "Yaoundé",
  address: "Main road",
  phones: [],
  status: "inactive" as const,
};
const ANN: ManagerOption = {
  id: "m-ann",
  fullName: "Ann Manager",
  email: "ann@x.test",
  status: "active",
  depotId: "d-akwa",
};
const BEN: ManagerOption = {
  id: "m-ben",
  fullName: "Ben Manager",
  email: "ben@x.test",
  status: "active",
  depotId: null,
};
const CAT: ManagerOption = {
  id: "m-cat",
  fullName: "Cat Manager",
  email: "cat@x.test",
  status: "active",
  depotId: "d-bastos",
};

afterEach(() => {
  vi.restoreAllMocks();
});

function fixtures() {
  return new MockDepotService([AKWA, BASTOS], [ANN, BEN, CAT]);
}

function renderDepots(path: string, depots = fixtures(), history: string[] = []) {
  return renderRoutes(path, { signedInAs: admin, depots, history });
}

describe("Depots list", () => {
  it("lists each depot with its location, manager and status", async () => {
    renderDepots("/admin/depots");
    const akwa = await screen.findByRole("link", { name: /Akwa/ });
    expect(akwa).toHaveTextContent("Douala");
    expect(akwa).toHaveTextContent("Manager: Ann Manager");
    expect(akwa).toHaveTextContent("Active");
    expect(akwa).toHaveAttribute("href", "/admin/depots/d-akwa");
    expect(screen.getByRole("link", { name: /Bastos/ })).toHaveTextContent("Inactive");
  });

  it("filters by name or location, ignoring case", async () => {
    renderDepots("/admin/depots");
    const search = await screen.findByLabelText("Search by name or location");
    await userEvent.type(search, "yaou");
    expect(screen.queryByRole("link", { name: /Akwa/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Bastos/ })).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, "Bafoussam");
    expect(screen.getByText('No depot matches "Bafoussam".')).toBeInTheDocument();
  });

  it("shows an empty state with the Add button still available", async () => {
    renderDepots("/admin/depots", new MockDepotService());
    expect(await screen.findByRole("heading", { name: "No depots yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add depot" })).toHaveAttribute("href", "/admin/depots/new");
  });

  it("offers Try again when the list cannot be loaded", async () => {
    const depots = fixtures();
    depots.failNextCallWith("unavailable");
    renderDepots("/admin/depots", depots);
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: /Akwa/ })).toBeInTheDocument();
  });

  it("Q-56: Back goes to More, inside the same tab", async () => {
    const { router } = renderDepots("/admin/depots");
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/admin/more");
  });
});

describe("Depot page", () => {
  it("shows the details, tap-to-call phones, Edit and the history section", async () => {
    renderDepots("/admin/depots/d-akwa");
    expect(await screen.findByRole("heading", { level: 1, name: "Akwa" })).toBeInTheDocument();
    expect(screen.getByText("Near the market")).toBeInTheDocument();
    expect(screen.getByText("Ann Manager")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+237 6 77 12 34 56" })).toHaveAttribute(
      "href",
      "tel:+237677123456",
    );
    expect(screen.getByRole("link", { name: "Edit depot" })).toHaveAttribute(
      "href",
      "/admin/depots/d-akwa/edit",
    );
    expect(screen.getByRole("heading", { name: "Distributions and receipts" })).toBeInTheDocument();
  });

  it("says when a depot has no manager or phone", async () => {
    renderDepots("/admin/depots/d-bastos", new MockDepotService([BASTOS]));
    expect(await screen.findByText("No manager yet")).toBeInTheDocument();
    expect(screen.getByText("No phone number")).toBeInTheDocument();
  });

  it("says when the depot does not exist", async () => {
    renderDepots("/admin/depots/missing");
    expect(await screen.findByRole("heading", { level: 1, name: "Depot not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to depots" })).toHaveAttribute("href", "/admin/depots");
  });

  it("offers Try again when the depot cannot be loaded", async () => {
    const depots = fixtures();
    depots.failNextCallWith("unavailable");
    renderDepots("/admin/depots/d-akwa", depots);
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Akwa" })).toBeInTheDocument();
  });

  it("Q-56: Back returns to the depots list", async () => {
    const { router } = renderDepots("/admin/depots/d-akwa");
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/admin/depots");
  });
});

describe("Add depot", () => {
  async function openNew(depots = fixtures()) {
    const view = renderDepots("/admin/depots/new", depots, ["/admin/depots"]);
    await screen.findByRole("heading", { level: 1, name: "New depot" });
    await screen.findByLabelText("Manager");
    return view;
  }

  it("DEP-02: explains every missing field and focuses the first", async () => {
    await openNew();
    await userEvent.click(screen.getByRole("button", { name: "Save depot" }));
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("Enter the depot name.");
    expect(screen.getByLabelText("Location")).toHaveAccessibleDescription(
      "Enter where the depot is, for example Douala.",
    );
    expect(screen.getByLabelText("Address or description")).toHaveAccessibleDescription(
      "Enter the address or a short description.",
    );
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });

  it("Q-57i: a wrong phone number is named on its own row and gets focus", async () => {
    await openNew();
    await userEvent.type(screen.getByLabelText("Name"), "Deido");
    await userEvent.type(screen.getByLabelText("Location"), "Douala");
    await userEvent.type(screen.getByLabelText("Address or description"), "Rond-point");
    await userEvent.click(screen.getByRole("button", { name: "Add another number" }));
    await userEvent.type(screen.getByLabelText("Phone 2"), "12345");
    await userEvent.click(screen.getByRole("button", { name: "Save depot" }));
    expect(screen.getByLabelText("Phone 2")).toHaveAccessibleDescription(
      "Enter a Cameroon number: 9 digits starting with 2 or 6, with or without +237.",
    );
    expect(screen.getByLabelText("Phone 2")).toHaveFocus();
  });

  it("lists managers with where they work, and saves with phones stored as +237…", async () => {
    const depots = fixtures();
    const { router } = await openNew(depots);
    expect(screen.getByRole("option", { name: "No manager" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Ann Manager (runs Akwa)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Ben Manager (no depot)" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Name"), "Deido");
    await userEvent.type(screen.getByLabelText("Location"), "Douala");
    await userEvent.type(screen.getByLabelText("Address or description"), "Rond-point");
    await userEvent.type(screen.getByLabelText("Phone 1"), "6 99 00 11 22");
    await userEvent.click(screen.getByRole("button", { name: "Add another number" }));
    await userEvent.type(screen.getByLabelText("Phone 2"), "+237 233 44 55 66");
    await userEvent.selectOptions(screen.getByLabelText("Manager"), "m-ben");
    await userEvent.click(screen.getByRole("button", { name: "Save depot" }));

    expect(await screen.findByText("Deido was saved.")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin/depots");
    const saved = (await depots.list()).find((depot) => depot.name === "Deido");
    expect(saved).toMatchObject({
      phones: ["+237699001122", "+237233445566"],
      status: "active",
      manager: { id: "m-ben", fullName: "Ben Manager" },
    });
  });

  it("DEP-03: warns that a manager who runs another depot will leave it", async () => {
    await openNew();
    await userEvent.selectOptions(screen.getByLabelText("Manager"), "m-ann");
    expect(screen.getByText("Ann Manager will move here. Akwa will have no manager.")).toBeInTheDocument();
  });

  it("removes a phone row", async () => {
    await openNew();
    await userEvent.click(screen.getByRole("button", { name: "Add another number" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove phone 2" }));
    expect(screen.queryByLabelText("Phone 2")).not.toBeInTheDocument();
  });

  it("says when there are no manager accounts yet", async () => {
    await openNew(new MockDepotService([AKWA]));
    expect(screen.getByLabelText("Manager")).toHaveAccessibleDescription(
      "No depot manager accounts yet. Create them in Users.",
    );
  });

  it("Q-56: shows Saving… while it saves", async () => {
    const depots = fixtures();
    await openNew(depots);
    await userEvent.type(screen.getByLabelText("Name"), "Deido");
    await userEvent.type(screen.getByLabelText("Location"), "Douala");
    await userEvent.type(screen.getByLabelText("Address or description"), "Rond-point");
    const release = depots.holdNextCall();
    await userEvent.click(screen.getByRole("button", { name: "Save depot" }));
    expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
    release();
    expect(await screen.findByText("Deido was saved.")).toBeInTheDocument();
  });

  it("NFR-06: cannot save offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await openNew();
    expect(screen.getByRole("button", { name: "Save depot" })).toBeDisabled();
  });

  it("Q-56: Back returns to the depots list", async () => {
    const { router } = await openNew();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/admin/depots");
  });
});

describe("Edit depot", () => {
  async function openEdit(depots = fixtures()) {
    const view = renderDepots("/admin/depots/d-akwa/edit", depots, ["/admin/depots/d-akwa"]);
    await screen.findByRole("heading", { level: 1, name: "Edit depot" });
    await screen.findByLabelText("Manager");
    return view;
  }

  it("fills the form; a depot with a manager offers no 'No manager' choice", async () => {
    await openEdit();
    expect(screen.getByLabelText("Name")).toHaveValue("Akwa");
    expect(screen.getByLabelText("Phone 1")).toHaveValue("+237 6 77 12 34 56");
    expect(screen.getByLabelText("Manager")).toHaveValue("m-ann");
    expect(screen.getByRole("option", { name: "Ann Manager (runs this depot)" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "No manager" })).not.toBeInTheDocument();
  });

  it("Q-57c: warns, then deactivates the replaced manager on save", async () => {
    const depots = fixtures();
    await openEdit(depots);
    await userEvent.selectOptions(screen.getByLabelText("Manager"), "m-ben");
    expect(
      screen.getByText("Ann Manager will be deactivated and will no longer run this depot."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save depot" }));
    expect(await screen.findByText("Akwa was saved.")).toBeInTheDocument();
    expect((await depots.get("d-akwa"))?.manager).toEqual({ id: "m-ben", fullName: "Ben Manager" });
    expect((await depots.listManagers()).find((manager) => manager.id === "m-ann")).toMatchObject({
      status: "inactive",
      depotId: null,
    });
  });

  it("DEP-01: deactivating keeps the depot in the list as Inactive", async () => {
    const depots = fixtures();
    await openEdit(depots);
    await userEvent.click(screen.getByLabelText("Active"));
    await userEvent.click(screen.getByRole("button", { name: "Save depot" }));
    expect(await screen.findByRole("link", { name: /Akwa/ })).toHaveTextContent("Inactive");
  });

  it("explains a refused save in plain words", async () => {
    const depots = fixtures();
    await openEdit(depots);
    depots.failNextCallWith("not_admin");
    await userEvent.click(screen.getByRole("button", { name: "Save depot" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only an active admin can change depots.");
  });

  it("says when the depot does not exist", async () => {
    renderDepots("/admin/depots/missing/edit");
    expect(await screen.findByRole("heading", { level: 1, name: "Depot not found" })).toBeInTheDocument();
  });

  it("offers Try again when the depot cannot be loaded", async () => {
    const depots = fixtures();
    depots.failNextCallWith("unavailable");
    renderDepots("/admin/depots/d-akwa/edit", depots);
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Edit depot" })).toBeInTheDocument();
  });

  it("Q-56: Back returns to this depot's page, not the list", async () => {
    const { router } = await openEdit();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/admin/depots/d-akwa");
  });
});
