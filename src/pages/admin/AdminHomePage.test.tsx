/**
 * Tests for Admin → Home.
 *
 * Rules under test:
 *  - ADM-01: six KPI cards.
 *  - ADM-02: quantities per unit as entered, no combined total.
 *  - Q-59c: Collected and Distributed Today are today's (Douala); Awaiting Confirmation
 *    and Discrepancies count every open item; Confirmed Receipts counts today's.
 *  - Q-59d: Remaining to Distribute per product in loaves, with the breakdown.
 *  - Q-59e / Q-58b: the latest discrepancies on Home, each opening its receipt, and a link to the full list.
 *  - ADM-03: today's collections. ADM-06 / Q-59f: items waiting over 24 hours stand out.
 *  - NFR-07: loading and error states. Q-56: Home has no Back.
 * The data is the spec's example (tests/fixtures/operations.ts); "now" is 4 October 2026, 13:00 in Douala.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { clearRecords, fixClock, openAdmin } from "../../../tests/helpers/adminOperations";

fixClock();

// A KPI card, found by its label inside the key numbers (other blocks reuse words like "Awaiting Confirmation").
const kpi = (label: string) => {
  const found = within(screen.getByRole("group", { name: "Key numbers" }))
    .getByText(label)
    .closest("a, div");
  if (!(found instanceof HTMLElement)) {
    throw new Error(`no card for ${label}`);
  }
  return found;
};

describe("Home KPIs", () => {
  it("ADM-01: shows the date and the six cards", async () => {
    openAdmin("/admin");
    expect(await screen.findByText("Collected Today")).toBeInTheDocument();
    expect(screen.getByTestId("today")).toHaveTextContent("Sunday, 4 October 2026");
    const numbers = within(screen.getByRole("group", { name: "Key numbers" }));
    for (const label of [
      "Collected Today",
      "Distributed Today",
      "Remaining to Distribute",
      "Awaiting Confirmation",
      "Confirmed Receipts",
      "Discrepancies",
    ]) {
      expect(numbers.getByText(label)).toBeInTheDocument();
    }
  });

  it("ADM-02 / Q-59c: today's collected and distributed, per unit as entered", async () => {
    openAdmin("/admin");
    await screen.findByText("Collected Today");
    expect(kpi("Collected Today")).toHaveTextContent("100 Loaves");
    expect(kpi("Distributed Today")).toHaveTextContent("20 Loaves");
  });

  it("Q-59d: remaining to distribute is per product in loaves, with the breakdown", async () => {
    openAdmin("/admin");
    await screen.findByText("Remaining to Distribute");
    // 100 (COL-00002) + 60 (COL-00003) = 160 loaves of Big Bread: 3 Caisses + 1 Pack.
    expect(kpi("Remaining to Distribute")).toHaveTextContent("Big Bread: 160 Loaves (3 Caisses + 1 Pack)");
  });

  it("Q-59c: Awaiting Confirmation and Discrepancies count all open items, and open the filtered list", async () => {
    openAdmin("/admin");
    await screen.findByRole("group", { name: "Key numbers" });
    const awaiting = kpi("Awaiting Confirmation");
    expect(awaiting).toHaveTextContent("2");
    expect(awaiting).toHaveTextContent("all open");
    expect(awaiting).toHaveAttribute("href", "/admin/distributions?status=awaiting_confirmation");
    const discrepancies = kpi("Discrepancies");
    expect(discrepancies).toHaveTextContent("1");
    expect(discrepancies).toHaveAttribute("href", "/admin/distributions?status=confirmed_with_discrepancy");
  });

  it("Q-59c: Confirmed Receipts counts today's confirmations with no difference", async () => {
    openAdmin("/admin");
    await screen.findByText("Confirmed Receipts");
    expect(kpi("Confirmed Receipts")).toHaveTextContent("0");
    expect(kpi("Confirmed Receipts")).toHaveTextContent("today");
  });

  it("uses the danger colour for Discrepancies only, and only when there are some", async () => {
    openAdmin("/admin");
    await screen.findByText("Discrepancies");
    expect(kpi("Discrepancies").querySelector(".text-danger")).not.toBeNull();
    expect(kpi("Awaiting Confirmation").querySelector(".text-danger")).toBeNull();
  });

  it("says Nothing, and shows zeros, on a day with no records", async () => {
    openAdmin("/admin", clearRecords);
    await screen.findByText("Collected Today");
    expect(kpi("Collected Today")).toHaveTextContent("Nothing");
    expect(kpi("Remaining to Distribute")).toHaveTextContent("Nothing left to distribute");
    expect(kpi("Awaiting Confirmation")).toHaveTextContent("0");
    expect(screen.getByText("No discrepancies.")).toBeInTheDocument();
    expect(screen.getByText("No collections yet today.")).toBeInTheDocument();
    expect(screen.queryByText("Needs attention")).not.toBeInTheDocument();
  });
});

describe("Home lists", () => {
  it("ADM-03: lists today's collections only, each opening its page", async () => {
    openAdmin("/admin");
    const activity = within(await screen.findByRole("region", { name: "Today's activity" }));
    const link = activity.getByRole("link", { name: /COL-00002/ });
    expect(link).toHaveAttribute("href", "/admin/collections/c2");
    expect(link).toHaveTextContent("In Progress");
    expect(link).toHaveTextContent("Big Bread: 100 Loaves");
    expect(activity.queryByRole("link", { name: /COL-00001/ })).not.toBeInTheDocument();
  });

  it("Q-59e: shows the latest discrepancies, each opening its receipt, and a link to the full list", async () => {
    openAdmin("/admin");
    const block = within(await screen.findByRole("region", { name: "Latest discrepancies" }));
    const receipt = block.getByRole("link", { name: /DIS-00001/ });
    expect(receipt).toHaveAttribute("href", "/admin/distributions/d1");
    expect(receipt).toHaveTextContent("Confirmed with Discrepancy");
    expect(receipt).toHaveTextContent("Akwa");
    expect(block.getByRole("link", { name: "See all 1" })).toHaveAttribute(
      "href",
      "/admin/distributions?status=confirmed_with_discrepancy",
    );
  });

  it("ADM-06 / Q-59f: Needs attention lists receipts and collections waiting over 24 hours", async () => {
    openAdmin("/admin");
    const attention = within(await screen.findByRole("region", { name: "Needs attention" }));
    expect(attention.getByText("1 receipt waiting over 24 hours")).toBeInTheDocument();
    expect(attention.getByRole("link", { name: /DIS-00003/ })).toHaveTextContent(
      "Waiting 26 hours, over 24 hours",
    );
    expect(attention.queryByRole("link", { name: /DIS-00004/ })).not.toBeInTheDocument();
    expect(attention.getByText("1 collection in progress over 24 hours")).toBeInTheDocument();
    expect(attention.getByRole("link", { name: /COL-00003/ })).toHaveTextContent(
      "Still in progress after 24 hours",
    );
    expect(attention.getByRole("link", { name: "All distributions" })).toHaveAttribute(
      "href",
      "/admin/distributions?status=awaiting_confirmation",
    );
    expect(attention.getByRole("link", { name: "All collections" })).toHaveAttribute(
      "href",
      "/admin/collections?status=in_progress",
    );
  });

  it("Q-56: a receipt opened from Home belongs to the Distributions tab, and Back stays in that tab", async () => {
    const { router } = openAdmin("/admin");
    const block = within(await screen.findByRole("region", { name: "Latest discrepancies" }));
    await userEvent.click(block.getByRole("link", { name: /DIS-00001/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "DIS-00001" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin/distributions/d1");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Distributions" })).toBeInTheDocument();
  });

  it("Q-56: Home has no Back", async () => {
    openAdmin("/admin");
    await screen.findByText("Collected Today");
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });
});

describe("Home states", () => {
  it("NFR-07: shows a loading state first", async () => {
    openAdmin("/admin", undefined, (operations) => {
      operations.holdNextCall();
    });
    // The title and date show at once; the cards are placeholders until the numbers arrive.
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.queryByRole("group", { name: "Key numbers" })).not.toBeInTheDocument();
  });

  it("NFR-07: offers Try again when Home cannot be loaded, and loads on retry", async () => {
    const { operations } = openAdmin("/admin");
    operations.failNextCallWith("unavailable");
    expect(await screen.findByText("Home could not be loaded.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Collected Today")).toBeInTheDocument();
  });
});
