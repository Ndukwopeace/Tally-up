/**
 * Tests for the navigation config of each portal.
 *
 * Rules under test:
 *  - REQUIREMENTS §7: Distributor 5 tabs, Depot Manager 4 tabs, in the stated order.
 *  - Q-40 / H-2: Admin sidebar max 7 items, Admin phone max 4 tabs.
 *  - NAV-1: admin contents are not decided, so nothing is listed yet.
 */
import { describe, expect, it } from "vitest";

import {
  ADMIN_MOBILE_NAV,
  ADMIN_SIDEBAR_NAV,
  DEPOT_NAV,
  DISTRIBUTOR_NAV,
  MAX_ADMIN_MOBILE_TABS,
  MAX_ADMIN_SIDEBAR_ITEMS,
  MAX_BOTTOM_TABS,
} from "./navigation";

const labelsAndPaths = (items: readonly { label: string; to: string }[]) =>
  items.map(({ label, to }) => [label, to]);

describe("Distributor bottom navigation (REQUIREMENTS §7)", () => {
  it("has the five tabs in order", () => {
    expect(labelsAndPaths(DISTRIBUTOR_NAV)).toEqual([
      ["Dashboard", "/distributor"],
      ["Collections", "/distributor/collections"],
      ["Distributions", "/distributor/distributions"],
      ["History", "/distributor/history"],
      ["Profile", "/distributor/profile"],
    ]);
  });
});

describe("Depot Manager bottom navigation (REQUIREMENTS §7)", () => {
  it("has the four tabs in order", () => {
    expect(labelsAndPaths(DEPOT_NAV)).toEqual([
      ["Dashboard", "/depot"],
      ["Receipts", "/depot/receipts"],
      ["History", "/depot/history"],
      ["Profile", "/depot/profile"],
    ]);
  });
});

describe("tab limits (H-2, Q-40)", () => {
  it("never exceeds 5 bottom tabs on mobile portals", () => {
    expect(MAX_BOTTOM_TABS).toBe(5);
    expect(DISTRIBUTOR_NAV.length).toBeLessThanOrEqual(MAX_BOTTOM_TABS);
    expect(DEPOT_NAV.length).toBeLessThanOrEqual(MAX_BOTTOM_TABS);
  });

  it("limits the admin sidebar to 7 items and admin phone tabs to 4", () => {
    expect(MAX_ADMIN_SIDEBAR_ITEMS).toBe(7);
    expect(MAX_ADMIN_MOBILE_TABS).toBe(4);
    expect(ADMIN_SIDEBAR_NAV.length).toBeLessThanOrEqual(MAX_ADMIN_SIDEBAR_ITEMS);
    expect(ADMIN_MOBILE_NAV.length).toBeLessThanOrEqual(MAX_ADMIN_MOBILE_TABS);
  });

  it("lists no admin items until the owner decides NAV-1", () => {
    expect(ADMIN_SIDEBAR_NAV).toEqual([]);
    expect(ADMIN_MOBILE_NAV).toEqual([]);
  });

  it("marks only portal home tabs as exact-match, so Dashboard is not highlighted on every page", () => {
    expect(DISTRIBUTOR_NAV.filter((item) => item.end).map((item) => item.to)).toEqual(["/distributor"]);
    expect(DEPOT_NAV.filter((item) => item.end).map((item) => item.to)).toEqual(["/depot"]);
  });
});
