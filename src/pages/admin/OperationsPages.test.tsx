/**
 * Tests for Admin → Collections, Distributions and their detail pages.
 *
 * Rules under test:
 *  - ADM-03: the list shows number, distributor, time, status and what was collected per product.
 *  - ADM-02 / REC-04: quantities per product and unit as entered, no combined total, no remaining.
 *  - ADM-04: collection detail with lines and depot allocations; receipts open.
 *  - RCP-10 / REC-02 / RCP-06: recorded against counted, difference in loaves, mixed units, comment.
 *  - COL-11 / RCP-15 / Q-59f: flagged after 24 hours; the age of a waiting receipt is shown.
 *  - COR-04: corrected values carry a marker with the original.
 *  - Q-59g / Q-59e: filters in the address, discrepancy shortcut, 25 per page with "Load more".
 *  - NFR-07: loading, empty, error states. Q-56: tabs have no Back; Back stays in its tab.
 * The data is the spec's example (tests/fixtures/operations.ts); "now" is fixed.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIXTURE_NOW, specOperations } from "../../../tests/fixtures/operations";
import { renderRoutes } from "../../../tests/helpers/renderRoutes";

import { MockDepotService } from "@/services/mock/MockDepotService";
import { MOCK_USERS } from "@/services/mock/MockAuthService";
import { MockOperationsService, type MockOperationsData } from "@/services/mock/MockOperationsService";
import { MockProductService } from "@/services/mock/MockProductService";
import { MockUserService } from "@/services/mock/MockUserService";
import { SPEC_PRODUCT } from "@/services/mock/specOperations";
import type { Depot, User } from "@/types/entities";

const admin = MOCK_USERS.admin.id;

const BIG = SPEC_PRODUCT;
const DEPOT = (id: string, name: string): Omit<Depot, "manager"> => ({
  id,
  name,
  location: "Douala",
  address: "Market",
  phones: [],
  status: "active",
});
const DISTRIBUTOR = (id: string, fullName: string): User => ({
  id,
  fullName,
  email: `${id}@x.test`,
  phones: [],
  role: "distributor",
  status: "active",
  depot: null,
});

// Only the clock is faked, so time-based flags are stable while the rest of the test runs normally.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FIXTURE_NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

function open(path: string, change?: (data: MockOperationsData) => void) {
  const data = specOperations();
  change?.(data);
  const operations = new MockOperationsService(data);
  const view = renderRoutes(path, {
    signedInAs: admin,
    operations,
    products: new MockProductService([BIG]),
    depots: new MockDepotService([DEPOT("akwa", "Akwa"), DEPOT("bonaberi", "Bonaberi")]),
    users: new MockUserService([
      DISTRIBUTOR("dist-1", "Dan Distributor"),
      DISTRIBUTOR("dist-2", "Dora Distributor"),
    ]),
  });
  return { ...view, operations };
}

// A card in a list, found by its number.
const card = (label: string) => screen.getByRole("link", { name: new RegExp(label) });

describe("Collections list", () => {
  it("ADM-03: lists each collection newest first with who, when, status and the quantities per unit", async () => {
    open("/admin/collections");
    await screen.findByRole("link", { name: /COL-00001/ });
    const labels = screen.getAllByRole("link", { name: /COL-0000/ }).map((link) => link.textContent);
    expect(labels[0]).toContain("COL-00002");
    expect(labels[1]).toContain("COL-00001");
    expect(labels[2]).toContain("COL-00003");

    const first = card("COL-00001");
    expect(first).toHaveAttribute("href", "/admin/collections/c1");
    expect(first).toHaveTextContent("Fully Distributed");
    expect(first).toHaveTextContent("Dan Distributor · Yesterday, 7:00 AM");
    // The card says what was collected, per product and unit, and nothing about hand-overs or what remains.
    expect(
      within(first)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Big Bread: 500 Loaves", "Big Bread: 10 Caisses"]);
    expect(first).not.toHaveTextContent(/handed over|remaining|distributed:/i);
    expect(card("COL-00002")).toHaveTextContent("Dora Distributor · Today, 11:00 AM");
    expect(card("COL-00002")).toHaveTextContent("Big Bread: 100 Loaves");
  });

  it("COL-11: flags a collection still In Progress after 24 hours, and only that one", async () => {
    open("/admin/collections");
    await screen.findByRole("link", { name: /COL-00003/ });
    expect(card("COL-00003")).toHaveTextContent("Still in progress after 24 hours");
    expect(card("COL-00002")).not.toHaveTextContent("Still in progress");
    expect(card("COL-00001")).not.toHaveTextContent("Still in progress");
  });

  it("Q-56: a tab has no Back arrow", async () => {
    open("/admin/collections");
    await screen.findByRole("link", { name: /COL-00001/ });
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("Q-59g: filters by status, and the filter lives in the address", async () => {
    const { router } = open("/admin/collections");
    await screen.findByRole("link", { name: /COL-00001/ });
    await userEvent.click(screen.getByText("Filters"));
    await userEvent.selectOptions(screen.getByLabelText("Status"), "in_progress");
    expect(router.state.location.search).toBe("?status=in_progress");
    expect(screen.queryByRole("link", { name: /COL-00001/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /COL-00002/ })).toBeInTheDocument();
    expect(screen.getByText("Filters (1 on)")).toBeInTheDocument();
  });

  it("Q-59g: filters by distributor and by date, and clears them", async () => {
    const { router } = open("/admin/collections");
    await screen.findByRole("link", { name: /COL-00001/ });
    await userEvent.click(screen.getByText("Filters"));
    await userEvent.selectOptions(screen.getByLabelText("Distributor"), "dist-1");
    expect(screen.getAllByRole("link", { name: /COL-/ })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(router.state.location.search).toBe("");
    expect(screen.getAllByRole("link", { name: /COL-/ })).toHaveLength(3);
    await userEvent.type(screen.getByLabelText("From"), "2026-10-04");
    expect(screen.getAllByRole("link", { name: /COL-/ })).toHaveLength(1);
    expect(router.state.location.search).toBe("?from=2026-10-04");
  });

  it("ignores a filter in the address that is not a known value", async () => {
    open("/admin/collections?status=bogus&from=yesterday");
    expect((await screen.findAllByRole("link", { name: /COL-/ })).length).toBe(3);
  });

  it("says so when no collection matches the filters, and when there are none at all", async () => {
    open("/admin/collections?to=2026-09-01");
    expect(await screen.findByText("No collection matches these filters.")).toBeInTheDocument();
  });

  it("shows an empty state with no records", async () => {
    renderRoutes("/admin/collections", { signedInAs: admin });
    expect(await screen.findByRole("heading", { name: "No collections yet" })).toBeInTheDocument();
  });

  it("offers Try again when the list cannot be loaded", async () => {
    const { operations } = open("/admin/collections");
    operations.failNextCallWith("unavailable");
    // The first load is already under way; reload through a fresh page to hit the failure.
    const failing = open("/admin/collections");
    failing.operations.failNextCallWith("unavailable");
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findAllByRole("link", { name: /COL-/ })).toHaveLength(3);
  });

  it("Q-59g: loads 25 at a time, with Load more", async () => {
    open("/admin/collections", (data) => {
      for (let n = 0; n < 27; n += 1) {
        const id = `x${String(n)}`;
        data.collections.push({
          id,
          label: `COL-9${String(n).padStart(4, "0")}`,
          createdAt: new Date(Date.UTC(2026, 8, 1, 0, n)).toISOString(),
          distributorId: "dist-1",
        });
        data.collectionItems.push({
          id: `i${id}`,
          collectionId: id,
          productId: "bb",
          unit: "Loaf",
          quantity: 10,
          loavesPerUnitSnapshot: 1,
        });
      }
    });
    await screen.findAllByRole("link", { name: /COL-/ });
    expect(screen.getAllByRole("link", { name: /COL-/ })).toHaveLength(25);
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findAllByRole("link", { name: /COL-/ })).toHaveLength(30);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });
});

describe("Collection detail", () => {
  it("ADM-04: shows the lines, and the allocations grouped by depot with what each received", async () => {
    open("/admin/collections/c1");
    expect(await screen.findByRole("heading", { level: 1, name: "COL-00001" })).toBeInTheDocument();
    expect(screen.getByText("Fully Distributed")).toBeInTheDocument();
    expect(screen.getByText("Dan Distributor")).toBeInTheDocument();
    expect(screen.getByText("Yesterday, 7:00 AM")).toBeInTheDocument();

    const lines = within(screen.getByRole("region", { name: "Collected products" }));
    expect(lines.getByText("500 Loaves")).toBeInTheDocument();
    expect(lines.getByText("10 Caisses (500 Loaves)")).toBeInTheDocument();

    // The owner wants no remaining figure on the collection page.
    expect(screen.queryByRole("region", { name: "Balance per product" })).not.toBeInTheDocument();
    expect(screen.queryByText(/remaining/i)).not.toBeInTheDocument();

    const allocations = within(screen.getByRole("region", { name: "Depot allocations" }));
    expect(allocations.getByRole("heading", { level: 3, name: "Akwa" })).toBeInTheDocument();
    expect(allocations.getByRole("heading", { level: 3, name: "Bonaberi" })).toBeInTheDocument();
    expect(allocations.getByRole("link", { name: /DIS-00001/ })).toHaveTextContent(
      "Confirmed with Discrepancy",
    );
    expect(allocations.getByRole("link", { name: /DIS-00002/ })).toHaveTextContent("Confirmed");
    expect(allocations.getByRole("link", { name: /DIS-00002/ })).toHaveTextContent("Big Bread: 45 Packs");
    expect(allocations.getByRole("link", { name: /DIS-00001/ })).toHaveAttribute(
      "href",
      "/admin/collections/c1/receipts/d1",
    );
  });

  it("COL-11: the collection page flags a collection still In Progress after 24 hours", async () => {
    open("/admin/collections/c3");
    expect(await screen.findByRole("heading", { level: 1, name: "COL-00003" })).toBeInTheDocument();
    expect(screen.getByText("Still in progress after 24 hours")).toBeInTheDocument();
  });

  it("RCP-15: flags a hand-over still waiting after 24 hours", async () => {
    open("/admin/collections/c1");
    const allocations = within(await screen.findByRole("region", { name: "Depot allocations" }));
    expect(allocations.getByRole("link", { name: /DIS-00003/ })).toHaveTextContent(
      "Waiting 26 hours, over 24 hours",
    );
  });

  it("COR-04: marks a corrected line, with what it was", async () => {
    open("/admin/collections/c1", (data) => {
      data.corrections.push({
        targetTable: "collection_items",
        targetId: "ci2",
        field: "quantity",
        correctedValue: "11",
        createdAt: "2026-10-04T00:00:00Z",
      });
    });
    expect(await screen.findByText("Corrected, was 10 Caisses")).toBeInTheDocument();
    expect(screen.getByText("11 Caisses (550 Loaves)")).toBeInTheDocument();
  });

  it("says when nothing has been handed over yet", async () => {
    open("/admin/collections/c2");
    expect(await screen.findByText("Nothing has been handed over to a depot yet.")).toBeInTheDocument();
  });

  it("says Collection not found for a stale link, with a way back", async () => {
    open("/admin/collections/gone");
    expect(await screen.findByRole("heading", { name: "Collection not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to collections" })).toHaveAttribute(
      "href",
      "/admin/collections",
    );
  });

  it("offers Try again when it cannot be loaded", async () => {
    const { operations } = open("/admin/collections/c1");
    operations.failNextCallWith("unavailable");
    const failing = open("/admin/collections/c1");
    failing.operations.failNextCallWith("unavailable");
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "COL-00001" })).toBeInTheDocument();
  });

  it("Q-56: Back goes to the Collections tab", async () => {
    const { router } = open("/admin/collections/c1", undefined);
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/admin/collections");
  });

  it("Q-56: a receipt opened from a collection goes Back to that collection, not to another tab", async () => {
    const { router } = open("/admin/collections/c1");
    await userEvent.click(await screen.findByRole("link", { name: /DIS-00001/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "DIS-00001" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/admin/collections/c1");
  });
});

describe("Distributions list", () => {
  it("ADM-04: lists hand-overs newest first with depot, who, when, what was recorded and the status", async () => {
    open("/admin/distributions");
    await screen.findByRole("link", { name: /DIS-00001/ });
    const labels = screen.getAllByRole("link", { name: /DIS-0000/ }).map((link) => link.textContent);
    expect(labels.map((text) => /DIS-0000\d/.exec(text)?.[0])).toEqual([
      "DIS-00004",
      "DIS-00003",
      "DIS-00002",
      "DIS-00001",
    ]);
    const discrepancy = card("DIS-00001");
    expect(discrepancy).toHaveAttribute("href", "/admin/distributions/d1");
    expect(discrepancy).toHaveTextContent("Confirmed with Discrepancy");
    expect(discrepancy).toHaveTextContent("Akwa");
    expect(discrepancy).toHaveTextContent("Dan Distributor · Yesterday, 9:00 AM");
    // Exactly what was handed over, line by line, with no loaf total to open up.
    expect(
      within(discrepancy)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Big Bread: 100 Loaves", "Big Bread: 3 Caisses"]);
    expect(discrepancy).not.toHaveTextContent(/remaining|of which/i);
  });

  it("RCP-15 / Q-59f: shows how long a receipt has waited, and flags it after 24 hours", async () => {
    open("/admin/distributions");
    await screen.findByRole("link", { name: /DIS-00004/ });
    expect(card("DIS-00004")).toHaveTextContent("Waiting 1 hour");
    expect(card("DIS-00004")).not.toHaveTextContent("over 24 hours");
    expect(card("DIS-00003")).toHaveTextContent("Waiting 26 hours, over 24 hours");
    expect(card("DIS-00002")).not.toHaveTextContent("Waiting");
  });

  it("Q-59g: filters by depot and by status", async () => {
    const { router } = open("/admin/distributions");
    await screen.findByRole("link", { name: /DIS-00001/ });
    await userEvent.click(screen.getByText("Filters"));
    await userEvent.selectOptions(screen.getByLabelText("Depot"), "bonaberi");
    expect(screen.getAllByRole("link", { name: /DIS-/ })).toHaveLength(2);
    await userEvent.selectOptions(screen.getByLabelText("Status"), "confirmed");
    expect(screen.getAllByRole("link", { name: /DIS-/ })).toHaveLength(1);
    expect(router.state.location.search).toBe("?depot=bonaberi&status=confirmed");
  });

  it("Q-59e: the 'with discrepancy only' shortcut shows just those, and unticking shows all again", async () => {
    const { router } = open("/admin/distributions");
    await screen.findByRole("link", { name: /DIS-00001/ });
    await userEvent.click(screen.getByText("Filters"));
    await userEvent.click(screen.getByRole("checkbox", { name: "With discrepancy only" }));
    expect(router.state.location.search).toBe("?status=confirmed_with_discrepancy");
    expect(screen.getAllByRole("link", { name: /DIS-/ })).toHaveLength(1);
    expect(screen.getByLabelText("Status")).toHaveValue("confirmed_with_discrepancy");
    await userEvent.click(screen.getByRole("checkbox", { name: "With discrepancy only" }));
    expect(screen.getAllByRole("link", { name: /DIS-/ })).toHaveLength(4);
  });

  it("Q-59e: a link with the discrepancy filter already on opens the list filtered", async () => {
    open("/admin/distributions?status=confirmed_with_discrepancy");
    expect(await screen.findAllByRole("link", { name: /DIS-/ })).toHaveLength(1);
    expect(screen.getByText("Filters (1 on)")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "With discrepancy only" })).toBeChecked();
  });

  it("filters by day, Douala time", async () => {
    open("/admin/distributions?from=2026-10-04");
    expect(await screen.findAllByRole("link", { name: /DIS-/ })).toHaveLength(1);
  });

  it("shows an empty state with no records, and a no-match line with filters", async () => {
    renderRoutes("/admin/distributions", { signedInAs: admin });
    expect(await screen.findByRole("heading", { name: "No distributions yet" })).toBeInTheDocument();
    open("/admin/distributions?to=2026-09-01");
    expect(await screen.findByText("No distribution matches these filters.")).toBeInTheDocument();
  });

  it("Q-59g: loads 25 at a time", async () => {
    open("/admin/distributions", (data) => {
      for (let n = 0; n < 26; n += 1) {
        data.distributions.push({
          id: `y${String(n)}`,
          label: `DIS-9${String(n).padStart(4, "0")}`,
          collectionId: "c1",
          depotId: "akwa",
          distributorId: "dist-1",
          createdAt: new Date(Date.UTC(2026, 8, 1, 0, n)).toISOString(),
        });
        data.distributionItems.push({
          id: `yi${String(n)}`,
          distributionId: `y${String(n)}`,
          productId: "bb",
          unit: "Loaf",
          quantity: 1,
          loavesPerUnitSnapshot: 1,
        });
      }
    });
    await screen.findAllByRole("link", { name: /DIS-/ });
    expect(screen.getAllByRole("link", { name: /DIS-/ })).toHaveLength(25);
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findAllByRole("link", { name: /DIS-/ })).toHaveLength(30);
  });

  it("offers Try again when the list cannot be loaded", async () => {
    const failing = open("/admin/distributions");
    failing.operations.failNextCallWith("unavailable");
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findAllByRole("link", { name: /DIS-/ })).toHaveLength(4);
  });
});

describe("Receipt detail", () => {
  it("RCP-10 / REC-02 / RCP-06: recorded against counted per line, with the difference in loaves, and the comment", async () => {
    open("/admin/distributions/d1");
    expect(await screen.findByRole("heading", { level: 1, name: "DIS-00001" })).toBeInTheDocument();
    expect(screen.getByText("Confirmed with Discrepancy")).toBeInTheDocument();
    expect(screen.getByText("Akwa")).toBeInTheDocument();
    expect(screen.getByText("Dan Distributor")).toBeInTheDocument();
    expect(screen.getByText("COL-00001")).toBeInTheDocument();

    const lines = within(screen.getByRole("region", { name: "Distributor recorded" })).getAllByRole(
      "listitem",
    );
    // Loaf first: 100 recorded, 95 counted, 5 short.
    expect(lines[0]).toHaveTextContent("Recorded: 100 Loaves");
    expect(lines[0]).toHaveTextContent("Depot count: 95 Loaves");
    expect(lines[0]).toHaveTextContent("Difference: −5 Loaves");
    // 3 Caisses recorded, counted as 2 Caisses + 5 Packs: the same 150 loaves.
    expect(lines[1]).toHaveTextContent("Recorded: 3 Caisses (150 Loaves)");
    expect(lines[1]).toHaveTextContent("Depot count: 5 Packs + 2 Caisses (150 Loaves)");
    expect(lines[1]).toHaveTextContent("Match");
    expect(screen.getByText("Five crushed")).toBeInTheDocument();
  });

  it("has no counts, and no comment, while Awaiting Confirmation", async () => {
    open("/admin/distributions/d4");
    expect(await screen.findByRole("heading", { level: 1, name: "DIS-00004" })).toBeInTheDocument();
    expect(screen.getByText("Not counted yet.")).toBeInTheDocument();
    expect(screen.getByText("No comment.")).toBeInTheDocument();
    expect(screen.queryByText(/Difference/)).not.toBeInTheDocument();
  });

  it("RCP-15: flags a receipt waiting more than 24 hours", async () => {
    open("/admin/distributions/d3");
    expect(await screen.findByText("Waiting 26 hours, over 24 hours")).toBeInTheDocument();
  });

  it("COR-04 / COR-05: a corrected count and comment are marked, and the difference follows the correction", async () => {
    open("/admin/distributions/d1", (data) => {
      data.corrections.push(
        {
          targetTable: "confirmation_counts",
          targetId: "cc3",
          field: "quantity",
          correctedValue: "100",
          createdAt: "2026-10-04T00:00:00Z",
        },
        {
          targetTable: "confirmations",
          targetId: "cf1",
          field: "comment",
          correctedValue: "Recounted: none crushed",
          createdAt: "2026-10-04T00:00:00Z",
        },
      );
    });
    expect(await screen.findByText("Corrected, was 95 Loaves")).toBeInTheDocument();
    expect(screen.getByText("Recounted: none crushed")).toBeInTheDocument();
    expect(screen.getByText("Corrected")).toBeInTheDocument();
    // The status follows the correction: no longer Confirmed with Discrepancy, and no difference shown.
    expect(screen.queryByText("Confirmed with Discrepancy")).not.toBeInTheDocument();
    expect(screen.queryByText(/Difference/)).not.toBeInTheDocument();
  });

  it("says Distribution not found for a stale link, with a way back", async () => {
    open("/admin/distributions/gone");
    expect(await screen.findByRole("heading", { name: "Distribution not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to distributions" })).toHaveAttribute(
      "href",
      "/admin/distributions",
    );
  });

  it("offers Try again when it cannot be loaded", async () => {
    const failing = open("/admin/distributions/d1");
    failing.operations.failNextCallWith("unavailable");
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "DIS-00001" })).toBeInTheDocument();
  });

  it("Q-56: Back goes to the Distributions tab", async () => {
    const { router } = open("/admin/distributions/d1");
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(router.state.location.pathname).toBe("/admin/distributions");
  });
});
