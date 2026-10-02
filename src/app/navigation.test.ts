/**
 * Tests for the navigation config of each portal.
 *
 * Rules under test:
 *  - Q-47: Admin phone tabs Home · Collections · Distributions · More;
 *          More holds Depots, Products, Users, Reports.
 *  - Q-46: Distributor tabs Dashboard · Collections · Distributions · Profile (History removed).
 *  - REQUIREMENTS §7: Depot Manager tabs Dashboard · Receipts · History · Profile.
 *  - H-2 / Q-40: never more than 4 admin phone tabs, never more than 5 bottom tabs.
 */
import { describe, expect, it } from "vitest";

import {
  ADMIN_MORE_ITEMS,
  ADMIN_NAV,
  DEPOT_NAV,
  DISTRIBUTOR_NAV,
  MAX_ADMIN_MOBILE_TABS,
  MAX_BOTTOM_TABS,
} from "./navigation";

const labelsAndPaths = (items: readonly { label: string; to: string }[]) =>
  items.map(({ label, to }) => [label, to]);

describe("Admin phone navigation (Q-47)", () => {
  it("has the four bottom tabs in order", () => {
    expect(labelsAndPaths(ADMIN_NAV)).toEqual([
      ["Home", "/admin"],
      ["Collections", "/admin/collections"],
      ["Distributions", "/admin/distributions"],
      ["More", "/admin/more"],
    ]);
  });

  it("lists Depots, Products, Users, Reports, Audit log and Settings inside More (Q-47, Q-51)", () => {
    expect(labelsAndPaths(ADMIN_MORE_ITEMS)).toEqual([
      ["Depots", "/admin/depots"],
      ["Products", "/admin/products"],
      ["Users", "/admin/users"],
      ["Reports", "/admin/reports"],
      ["Audit log", "/admin/audit"],
      ["Settings", "/admin/settings"],
    ]);
  });

  it("gives every More item a short description of what it holds", () => {
    for (const item of ADMIN_MORE_ITEMS) {
      expect(item.description.length).toBeGreaterThan(0);
    }
  });

  it("keeps the More tab active on the pages it opens", () => {
    const more = ADMIN_NAV.find((item) => item.to === "/admin/more");
    expect(more?.activeFor).toEqual([
      "/admin/depots",
      "/admin/products",
      "/admin/users",
      "/admin/reports",
      "/admin/audit",
      "/admin/settings",
    ]);
  });
});

describe("Distributor bottom navigation (Q-46)", () => {
  it("has four tabs; History lives inside Collections and Distributions", () => {
    expect(labelsAndPaths(DISTRIBUTOR_NAV)).toEqual([
      ["Dashboard", "/distributor"],
      ["Collections", "/distributor/collections"],
      ["Distributions", "/distributor/distributions"],
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
  it("never exceeds the tab limits", () => {
    expect(MAX_BOTTOM_TABS).toBe(5);
    expect(MAX_ADMIN_MOBILE_TABS).toBe(4);
    expect(ADMIN_NAV.length).toBeLessThanOrEqual(MAX_ADMIN_MOBILE_TABS);
    expect(DISTRIBUTOR_NAV.length).toBeLessThanOrEqual(MAX_BOTTOM_TABS);
    expect(DEPOT_NAV.length).toBeLessThanOrEqual(MAX_BOTTOM_TABS);
  });

  it("marks only portal home tabs as exact-match, so Home is not highlighted on every page", () => {
    expect(ADMIN_NAV.filter((item) => item.end).map((item) => item.to)).toEqual(["/admin"]);
    expect(DISTRIBUTOR_NAV.filter((item) => item.end).map((item) => item.to)).toEqual(["/distributor"]);
    expect(DEPOT_NAV.filter((item) => item.end).map((item) => item.to)).toEqual(["/depot"]);
  });
});
