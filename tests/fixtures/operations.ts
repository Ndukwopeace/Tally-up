/**
 * The spec's example data for the monitoring screens' tests.
 *
 * WHY:  The mock service and the page tests need records whose answers are known.
 *       These are the same numbers supabase/tests/a3b_list_views.test.sql uses, so
 *       the mock, the TypeScript rules and the database views are checked against
 *       one story: Big Bread (1 Pack = 10, 1 Caisse = 50 loaves); 1,000 loaves collected
 *       (500 Loaves + 10 Caisse); handed over as 3 Caisse + 100 Loaves to Akwa, 45 Packs
 *       to Bonaberi and 300 Loaves to Akwa; Akwa counted 95 of the 100 Loaves.
 * HOW:  Plain data in the shape MockOperationsService takes.
 * WHEN: Imported by tests only.
 * SECURITY: Fictional.
 */
import type { MockOperationsData } from "@/services/mock/MockOperationsService";

const NOW = new Date("2026-10-04T12:00:00Z");
const HOURS_AGO = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

export const FIXTURE_NOW = NOW;

export function specOperations(): MockOperationsData {
  return {
    people: [
      { id: "dist-1", fullName: "Dan Distributor" },
      { id: "dist-2", fullName: "Dora Distributor" },
      { id: "mgr-1", fullName: "Mia Manager" },
    ],
    depots: [
      { id: "akwa", name: "Akwa" },
      { id: "bonaberi", name: "Bonaberi" },
    ],
    collections: [
      { id: "c1", label: "COL-00001", createdAt: HOURS_AGO(30), distributorId: "dist-1" },
      { id: "c2", label: "COL-00002", createdAt: HOURS_AGO(2), distributorId: "dist-2" },
      { id: "c3", label: "COL-00003", createdAt: HOURS_AGO(60), distributorId: "dist-2" },
    ],
    collectionItems: [
      {
        id: "ci1",
        collectionId: "c1",
        productId: "bb",
        unit: "Loaf",
        quantity: 500,
        loavesPerUnitSnapshot: 1,
      },
      {
        id: "ci2",
        collectionId: "c1",
        productId: "bb",
        unit: "Caisse",
        quantity: 10,
        loavesPerUnitSnapshot: 50,
      },
      {
        id: "ci3",
        collectionId: "c2",
        productId: "bb",
        unit: "Loaf",
        quantity: 100,
        loavesPerUnitSnapshot: 1,
      },
      {
        id: "ci4",
        collectionId: "c3",
        productId: "bb",
        unit: "Loaf",
        quantity: 80,
        loavesPerUnitSnapshot: 1,
      },
    ],
    distributions: [
      {
        id: "d1",
        label: "DIS-00001",
        collectionId: "c1",
        depotId: "akwa",
        distributorId: "dist-1",
        createdAt: HOURS_AGO(28),
      },
      {
        id: "d2",
        label: "DIS-00002",
        collectionId: "c1",
        depotId: "bonaberi",
        distributorId: "dist-1",
        createdAt: HOURS_AGO(27),
      },
      {
        id: "d3",
        label: "DIS-00003",
        collectionId: "c1",
        depotId: "akwa",
        distributorId: "dist-1",
        createdAt: HOURS_AGO(26),
      },
      {
        id: "d4",
        label: "DIS-00004",
        collectionId: "c3",
        depotId: "bonaberi",
        distributorId: "dist-2",
        createdAt: HOURS_AGO(1),
      },
    ],
    distributionItems: [
      {
        id: "di1",
        distributionId: "d1",
        productId: "bb",
        unit: "Caisse",
        quantity: 3,
        loavesPerUnitSnapshot: 50,
      },
      {
        id: "di2",
        distributionId: "d1",
        productId: "bb",
        unit: "Loaf",
        quantity: 100,
        loavesPerUnitSnapshot: 1,
      },
      {
        id: "di3",
        distributionId: "d2",
        productId: "bb",
        unit: "Pack",
        quantity: 45,
        loavesPerUnitSnapshot: 10,
      },
      {
        id: "di4",
        distributionId: "d3",
        productId: "bb",
        unit: "Loaf",
        quantity: 300,
        loavesPerUnitSnapshot: 1,
      },
      {
        id: "di5",
        distributionId: "d4",
        productId: "bb",
        unit: "Loaf",
        quantity: 20,
        loavesPerUnitSnapshot: 1,
      },
    ],
    confirmations: [
      {
        id: "cf1",
        distributionId: "d1",
        managerId: "mgr-1",
        comment: "Five crushed",
        confirmedAt: HOURS_AGO(26),
      },
      { id: "cf2", distributionId: "d2", managerId: "mgr-1", comment: null, confirmedAt: HOURS_AGO(25) },
    ],
    confirmationCounts: [
      {
        id: "cc1",
        confirmationId: "cf1",
        itemId: "di1",
        unit: "Caisse",
        quantity: 2,
        loavesPerUnitSnapshot: 50,
      },
      {
        id: "cc2",
        confirmationId: "cf1",
        itemId: "di1",
        unit: "Pack",
        quantity: 5,
        loavesPerUnitSnapshot: 10,
      },
      {
        id: "cc3",
        confirmationId: "cf1",
        itemId: "di2",
        unit: "Loaf",
        quantity: 95,
        loavesPerUnitSnapshot: 1,
      },
      {
        id: "cc4",
        confirmationId: "cf2",
        itemId: "di3",
        unit: "Pack",
        quantity: 45,
        loavesPerUnitSnapshot: 10,
      },
    ],
    corrections: [],
  };
}
