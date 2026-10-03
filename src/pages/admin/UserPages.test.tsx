/**
 * Tests for Admin → Users (list, add, edit, reset password).
 *
 * Rules under test:
 *  - USR-01: create, edit, activate/deactivate; no delete.
 *  - USR-02: name and email required; phone numbers optional (Q-57i); one email per account.
 *  - USR-03 / Q-57c: an active depot manager needs a depot; the replaced manager is deactivated.
 *  - Q-57a / Q-57b: the admin types a temporary password when creating and when resetting.
 *  - Q-57f / USR-06: an admin cannot deactivate themselves; the only active admin keeps the role.
 *  - Q-57g: email and role can be edited.
 *  - NFR-07: loading, empty, error states. NFR-06: no saving offline.
 *  - Q-56: Back stays inside the tab; saving shows progress.
 */
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderRoutes } from "../../../tests/helpers/renderRoutes";

import { MOCK_USERS } from "@/services/mock/MockAuthService";
import { MockDepotService } from "@/services/mock/MockDepotService";
import { MockUserService } from "@/services/mock/MockUserService";
import type { ManagerOption, User } from "@/types/entities";

const admin = MOCK_USERS.admin.id;

const AKWA = {
  id: "d-akwa",
  name: "Akwa",
  location: "Douala",
  address: "Market",
  phones: [],
  status: "active" as const,
};
const BONABERI = { ...AKWA, id: "d-bon", name: "Bonaberi" };
const CLOSED = { ...AKWA, id: "d-closed", name: "Closed Depot", status: "inactive" as const };
const MIA_AS_MANAGER: ManagerOption = {
  id: "u-mia",
  fullName: "Mia Manager",
  email: "mia@x.test",
  status: "active",
  depotId: "d-akwa",
};

const AMA: User = {
  id: admin,
  fullName: "Ama Admin",
  email: "admin@tallyup.test",
  phones: [],
  role: "admin",
  status: "active",
  depot: null,
};
const MIA: User = {
  id: "u-mia",
  fullName: "Mia Manager",
  email: "mia@x.test",
  phones: ["+237677123456"],
  role: "depot_manager",
  status: "active",
  depot: { id: "d-akwa", name: "Akwa" },
};
const OLD: User = {
  id: "u-old",
  fullName: "Old Distributor",
  email: "old@x.test",
  phones: [],
  role: "distributor",
  status: "inactive",
  depot: null,
};
const SECOND_ADMIN: User = { ...AMA, id: "u-two", fullName: "Zed Admin", email: "zed@x.test" };

afterEach(() => {
  vi.restoreAllMocks();
});

function people(extra: User[] = [SECOND_ADMIN]) {
  return new MockUserService(
    [AMA, MIA, OLD, ...extra],
    [
      { id: "d-akwa", name: "Akwa" },
      { id: "d-bon", name: "Bonaberi" },
    ],
    admin,
  );
}

function depotsWithMia() {
  return new MockDepotService([AKWA, BONABERI, CLOSED], [MIA_AS_MANAGER]);
}

function renderUsers(path: string, users = people(), history: string[] = []) {
  return renderRoutes(path, { signedInAs: admin, users, depots: depotsWithMia(), history });
}

// Opens the new-user form and waits for it.
async function openNew(users = people()) {
  const view = renderUsers("/admin/users/new", users);
  await screen.findByLabelText("Full name");
  return { ...view, users };
}

async function fillBasics(name = "Ann Distributor", email = "Ann@Example.test") {
  await userEvent.type(screen.getByLabelText("Full name"), name);
  await userEvent.type(screen.getByLabelText("Email"), email);
}

async function fillPassword(password = "temp-pass-1", repeat = password) {
  await userEvent.type(screen.getByLabelText("Temporary password"), password);
  await userEvent.type(screen.getByLabelText("Repeat temporary password"), repeat);
}

describe("Users list", () => {
  it("lists each account with its email, role, depot and status", async () => {
    renderUsers("/admin/users");
    const mia = await screen.findByRole("link", { name: /Mia Manager/ });
    expect(mia).toHaveTextContent("mia@x.test");
    expect(mia).toHaveTextContent("Depot Manager · Runs Akwa");
    expect(mia).toHaveTextContent("Active");
    expect(mia).toHaveAttribute("href", "/admin/users/u-mia/edit");
    expect(screen.getByRole("link", { name: /Old Distributor/ })).toHaveTextContent("Inactive");
  });

  it("filters by name or email, ignoring case", async () => {
    renderUsers("/admin/users");
    const search = await screen.findByLabelText("Search by name or email");
    await userEvent.type(search, "OLD@");
    expect(screen.queryByRole("link", { name: /Mia Manager/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Old Distributor/ })).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, "nobody");
    expect(screen.getByText('No user matches "nobody".')).toBeInTheDocument();
  });

  it("shows an empty state with the Add button still available", async () => {
    renderUsers("/admin/users", new MockUserService());
    expect(await screen.findByRole("heading", { name: "No users yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add user" })).toHaveAttribute("href", "/admin/users/new");
  });

  it("offers Try again when the list cannot be loaded", async () => {
    const users = people();
    users.failNextCallWith("unavailable");
    renderUsers("/admin/users", users);
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: /Mia Manager/ })).toBeInTheDocument();
  });

  it("Q-56: Back goes to More, inside the same tab", async () => {
    const { router } = renderUsers("/admin/users");
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/admin/more");
  });
});

describe("Add user", () => {
  it("USR-02 / Q-57a: needs a name, an email and the temporary password", async () => {
    await openNew();
    await userEvent.click(screen.getByRole("button", { name: "Create user" }));
    expect(screen.getByLabelText("Full name")).toHaveAccessibleDescription("Enter the full name.");
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      expect.stringContaining("Enter your email address."),
    );
    expect(screen.getByLabelText("Temporary password")).toHaveAccessibleDescription(
      expect.stringContaining("Enter a new password."),
    );
    // WCAG 3.3.1: focus goes to the first field to fix.
    expect(screen.getByLabelText("Full name")).toHaveFocus();
  });

  it("refuses an email that is not an email, and two passwords that differ", async () => {
    await openNew();
    await fillBasics("Ann", "ann");
    await fillPassword("one-pass-1", "other-pass");
    await userEvent.click(screen.getByRole("button", { name: "Create user" }));
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      expect.stringContaining("Enter an email address like name@example.com."),
    );
    expect(screen.getByLabelText("Repeat temporary password")).toHaveAccessibleDescription(
      "The two passwords do not match.",
    );
  });

  it("USR-01: creates a distributor, remembers the password for the admin to pass on, and goes to the list", async () => {
    const { router, users } = await openNew();
    await fillBasics();
    await userEvent.type(screen.getByLabelText("Phone 1"), "6 77 12 34 56");
    await userEvent.click(screen.getByRole("button", { name: "Add another number" }));
    await userEvent.type(screen.getByLabelText("Phone 2"), "+237 233 44 55 66");
    await fillPassword();
    await userEvent.click(screen.getByRole("button", { name: "Create user" }));

    expect(
      await screen.findByText("Ann Distributor was created. Give them the temporary password you chose."),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin/users");
    const created = (await users.list()).find((user) => user.fullName === "Ann Distributor");
    expect(created).toMatchObject({
      email: "ann@example.test",
      phones: ["+237677123456", "+237233445566"],
      role: "distributor",
      status: "active",
    });
    expect(users.passwords.get(created?.id ?? "")).toBe("temp-pass-1");
  });

  it("Q-57i: flags a phone number that is not a Cameroon number", async () => {
    await openNew();
    await fillBasics();
    await userEvent.type(screen.getByLabelText("Phone 1"), "12345");
    await fillPassword();
    await userEvent.click(screen.getByRole("button", { name: "Create user" }));
    expect(screen.getByLabelText("Phone 1")).toHaveAccessibleDescription(
      "Enter a Cameroon number: 9 digits starting with 2 or 6, with or without +237.",
    );
  });

  it("USR-03: a depot manager needs a depot; only then is the form accepted", async () => {
    const { users } = await openNew();
    expect(screen.queryByLabelText("Depot")).not.toBeInTheDocument();
    await fillBasics("New Manager", "new.manager@x.test");
    await userEvent.selectOptions(screen.getByLabelText("Role"), "depot_manager");
    await fillPassword();
    await userEvent.click(screen.getByRole("button", { name: "Create user" }));
    expect(screen.getByLabelText("Depot")).toHaveAccessibleDescription("Choose the depot this manager runs.");
    expect(screen.getByLabelText("Depot")).toHaveFocus();

    await userEvent.selectOptions(screen.getByLabelText("Depot"), "d-bon");
    await userEvent.click(screen.getByRole("button", { name: "Create user" }));
    expect(await screen.findByText(/New Manager was created/)).toBeInTheDocument();
    expect((await users.list()).find((user) => user.fullName === "New Manager")?.depot).toEqual({
      id: "d-bon",
      name: "Bonaberi",
    });
  });

  it("lists each depot with who runs it", async () => {
    await openNew();
    await userEvent.selectOptions(screen.getByLabelText("Role"), "depot_manager");
    expect(screen.getByRole("option", { name: "Akwa (Mia Manager runs it)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Bonaberi (no manager)" })).toBeInTheDocument();
  });

  it("Q-58: does not offer an inactive depot to a depot manager", async () => {
    await openNew();
    await userEvent.selectOptions(screen.getByLabelText("Role"), "depot_manager");
    expect(screen.getByRole("option", { name: "Bonaberi (no manager)" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Closed Depot/ })).not.toBeInTheDocument();
  });

  it("Q-57c: warns that the manager who runs the chosen depot will be deactivated", async () => {
    await openNew();
    await userEvent.selectOptions(screen.getByLabelText("Role"), "depot_manager");
    await userEvent.selectOptions(screen.getByLabelText("Depot"), "d-akwa");
    expect(
      screen.getByText("Mia Manager will be deactivated and will no longer run Akwa."),
    ).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Depot"), "d-bon");
    expect(screen.queryByText(/will be deactivated/)).not.toBeInTheDocument();
  });

  it("Q-57c: an inactive manager has no depot field", async () => {
    await openNew();
    await userEvent.selectOptions(screen.getByLabelText("Role"), "depot_manager");
    expect(screen.getByLabelText("Depot")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Active" }));
    expect(screen.queryByLabelText("Depot")).not.toBeInTheDocument();
  });

  it("USR-02: shows the server's refusal in words and keeps what was typed", async () => {
    const users = people();
    await openNew(users);
    await fillBasics("Ann", "mia@x.test");
    await fillPassword();
    await userEvent.click(screen.getByRole("button", { name: "Create user" }));
    expect(await screen.findByText("Another user already has this email.")).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue("Ann");
  });

  it("shows a weak-password refusal from Supabase in words", async () => {
    const users = people();
    await openNew(users);
    await fillBasics();
    await fillPassword();
    users.failNextCallWith("weak_password");
    await userEvent.click(screen.getByRole("button", { name: "Create user" }));
    expect(
      await screen.findByText("That password is too weak. Choose a longer, harder one."),
    ).toBeInTheDocument();
  });

  it("Q-56: shows Saving… while it saves", async () => {
    const users = people();
    await openNew(users);
    await fillBasics();
    await fillPassword();
    const release = users.holdNextCall();
    await userEvent.click(screen.getByRole("button", { name: "Create user" }));
    expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
    release();
    expect(await screen.findByText(/Ann Distributor was created/)).toBeInTheDocument();
  });

  it("NFR-06: cannot save offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await openNew();
    expect(screen.getByRole("button", { name: "Create user" })).toBeDisabled();
  });

  it("Q-56: Back goes to the Users list", async () => {
    const { router } = await openNew();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/admin/users");
  });
});

describe("Edit user", () => {
  // Opens the edit page and waits until the depot list and the user list have loaded too.
  async function openEdit(id: string, users = people()) {
    const list = vi.spyOn(users, "list");
    const view = renderUsers(`/admin/users/${id}/edit`, users);
    await screen.findByLabelText("Full name");
    await screen.findByRole("option", { name: /Akwa/ }).catch(() => undefined);
    await waitFor(() => {
      expect(list).toHaveBeenCalled();
    });
    await list.mock.results[0]?.value;
    await act(async () => {
      await Promise.resolve();
    });
    return { ...view, users };
  }

  it("shows the saved values, phones grouped, and no password field", async () => {
    await openEdit("u-mia");
    expect(screen.getByLabelText("Full name")).toHaveValue("Mia Manager");
    expect(screen.getByLabelText("Email")).toHaveValue("mia@x.test");
    expect(screen.getByLabelText("Phone 1")).toHaveValue("+237 6 77 12 34 56");
    expect(screen.getByLabelText("Role")).toHaveValue("depot_manager");
    expect(screen.getByLabelText("Depot")).toHaveValue("d-akwa");
    expect(screen.getByRole("checkbox", { name: "Active" })).toBeChecked();
    // Only the reset form below has a password field (Q-57b).
    expect(screen.getAllByLabelText("Temporary password")).toHaveLength(1);
  });

  it("Q-57g: changes the email and the role; a manager given another role loses the depot", async () => {
    const { users } = await openEdit("u-mia");
    await userEvent.clear(screen.getByLabelText("Email"));
    await userEvent.type(screen.getByLabelText("Email"), "mia.new@x.test");
    await userEvent.selectOptions(screen.getByLabelText("Role"), "distributor");
    expect(
      screen.getByText("Mia Manager will no longer run Akwa. Akwa will have no manager."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save user" }));
    expect(await screen.findByText("Mia Manager was saved.")).toBeInTheDocument();
    expect(await users.get("u-mia")).toMatchObject({
      email: "mia.new@x.test",
      role: "distributor",
      depot: null,
    });
  });

  it("Q-57c: moving a manager to another depot says the old depot is left without one", async () => {
    await openEdit("u-mia");
    await userEvent.selectOptions(screen.getByLabelText("Depot"), "d-bon");
    expect(
      screen.getByText("Mia Manager will no longer run Akwa. Akwa will have no manager."),
    ).toBeInTheDocument();
  });

  it("USR-01: deactivates an account, which takes a manager off the depot", async () => {
    const { users } = await openEdit("u-mia");
    await userEvent.click(screen.getByRole("checkbox", { name: "Active" }));
    expect(screen.queryByLabelText("Depot")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save user" }));
    expect(await screen.findByText("Mia Manager was saved.")).toBeInTheDocument();
    expect(await users.get("u-mia")).toMatchObject({ status: "inactive", depot: null });
  });

  it("Q-57c: reactivating a manager asks for a depot", async () => {
    const users = new MockUserService(
      [AMA, { ...MIA, status: "inactive", depot: null }],
      [{ id: "d-akwa", name: "Akwa" }],
      admin,
    );
    await openEdit("u-mia", users);
    await userEvent.click(screen.getByRole("checkbox", { name: "Active" }));
    await userEvent.click(screen.getByRole("button", { name: "Save user" }));
    expect(screen.getByLabelText("Depot")).toHaveAccessibleDescription("Choose the depot this manager runs.");
  });

  it("Q-57f: an admin cannot deactivate their own account", async () => {
    await openEdit(admin);
    const active = screen.getByRole("checkbox", { name: "Active" });
    expect(active).toBeDisabled();
    expect(active).toHaveAccessibleDescription(
      expect.stringContaining("You cannot deactivate your own account."),
    );
  });

  it("USR-06: the only active admin cannot change role; with another admin they can", async () => {
    await openEdit(admin, people([]));
    expect(screen.getByLabelText("Role")).toBeDisabled();
    expect(screen.getByLabelText("Role")).toHaveAccessibleDescription(
      "You are the only active admin, so you stay an admin.",
    );
  });

  it("USR-06: with another active admin the role can be changed", async () => {
    await openEdit(admin);
    expect(screen.getByLabelText("Role")).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Active" })).toBeDisabled();
  });

  it("another admin can be deactivated", async () => {
    const { users } = await openEdit("u-two");
    expect(screen.getByRole("checkbox", { name: "Active" })).toBeEnabled();
    await userEvent.click(screen.getByRole("checkbox", { name: "Active" }));
    await userEvent.click(screen.getByRole("button", { name: "Save user" }));
    expect(await screen.findByText("Zed Admin was saved.")).toBeInTheDocument();
    expect((await users.get("u-two"))?.status).toBe("inactive");
  });

  it("says User not found for a stale link, with a way back", async () => {
    renderUsers("/admin/users/gone/edit");
    expect(await screen.findByRole("heading", { name: "User not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to users" })).toHaveAttribute("href", "/admin/users");
  });

  it("offers Try again when the account cannot be loaded", async () => {
    const users = people();
    users.failNextCallWith("unavailable");
    renderUsers("/admin/users/u-mia/edit", users);
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Full name")).toHaveValue("Mia Manager");
  });

  it("Q-56: Back goes to the Users list", async () => {
    const { router } = await openEdit("u-mia");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/admin/users");
  });
});

describe("Reset password (USR-04, Q-57b)", () => {
  async function openReset() {
    const users = people();
    renderUsers("/admin/users/u-mia/edit", users);
    await screen.findByRole("heading", { name: "Reset password" });
    return users;
  }

  it("sets a new temporary password and clears the fields", async () => {
    const users = await openReset();
    await userEvent.type(screen.getByLabelText("Temporary password"), "brand-new-1");
    await userEvent.type(screen.getByLabelText("Repeat temporary password"), "brand-new-1");
    await userEvent.click(screen.getByRole("button", { name: "Set new password" }));
    expect(
      await screen.findByText("New temporary password set. Give it to Mia Manager."),
    ).toBeInTheDocument();
    expect(users.passwords.get("u-mia")).toBe("brand-new-1");
    expect(screen.getByLabelText("Temporary password")).toHaveValue("");
    expect(screen.getByLabelText("Repeat temporary password")).toHaveValue("");
  });

  it("needs a password, typed twice the same", async () => {
    const users = await openReset();
    await userEvent.click(screen.getByRole("button", { name: "Set new password" }));
    expect(screen.getByLabelText("Temporary password")).toHaveAccessibleDescription("Enter a new password.");
    expect(screen.getByLabelText("Temporary password")).toHaveFocus();
    await userEvent.type(screen.getByLabelText("Temporary password"), "brand-new-1");
    await userEvent.type(screen.getByLabelText("Repeat temporary password"), "different");
    await userEvent.click(screen.getByRole("button", { name: "Set new password" }));
    expect(screen.getByLabelText("Repeat temporary password")).toHaveAccessibleDescription(
      "The two passwords do not match.",
    );
    expect(screen.getByLabelText("Repeat temporary password")).toHaveFocus();
    expect(users.passwords.size).toBe(0);
  });

  it("shows the server's refusal in words", async () => {
    const users = await openReset();
    await userEvent.type(screen.getByLabelText("Temporary password"), "123");
    await userEvent.type(screen.getByLabelText("Repeat temporary password"), "123");
    users.failNextCallWith("weak_password");
    await userEvent.click(screen.getByRole("button", { name: "Set new password" }));
    expect(
      await screen.findByText("That password is too weak. Choose a longer, harder one."),
    ).toBeInTheDocument();
  });

  it("NFR-06: cannot reset offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await openReset();
    expect(screen.getByRole("button", { name: "Set new password" })).toBeDisabled();
  });
});
