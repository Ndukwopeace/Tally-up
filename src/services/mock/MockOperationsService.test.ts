/**
 * Tests for the mock OperationsService: it must give the answers the database views give,
 * so page tests written against it hold for Supabase.
 *
 * Rules under test: REC-01 (Collected = Distributed + Remaining, in loaves), COL-08 and
 * RCP-11 (statuses computed), REC-02 and RCP-06 (difference in loaves, counts in several
 * units), COR-04 and COR-05 (corrected values used and marked), ADM-02 (per unit as
 * entered), Q-59g (filters, 25 per page, newest first). The data is the spec's example
 * (tests/fixtures/operations.ts), the same story as supabase/tests/a3b_list_views.test.sql.
 */
import { describe, expect, it } from "vitest";

import { specOperations } from "../../../tests/fixtures/operations";

import { MockOperationsService, type MockOperationsData } from "./MockOperationsService";

import { OperationsError, PAGE_SIZE } from "@/services/interfaces/OperationsService";

function service(change?: (data: MockOperationsData) => void) {
  const data = specOperations();
  change?.(data);
  return new MockOperationsService(data);
}

describe("listCollections (ADM-03)", () => {
  it("lists newest first, with who, status and quantities per unit as entered", async () => {
    const { rows, hasMore } = await service().listCollections({}, 0);
    expect(rows.map((row) => row.label)).toEqual(["COL-00002", "COL-00001", "COL-00003"]);
    expect(hasMore).toBe(false);
    const first = rows.find((row) => row.label === "COL-00001");
    expect(first).toMatchObject({
      distributorName: "Dan Distributor",
      status: "fully_distributed",
      collected: [
        { productId: "bb", unit: "Loaf", quantity: 500 },
        { productId: "bb", unit: "Caisse", quantity: 10 },
      ],
    });
    expect(first).not.toHaveProperty("remainingLoaves");
    expect(first).not.toHaveProperty("distributed");
  });

  it("COL-08: a collection with loaves still to hand over is In Progress", async () => {
    const { rows } = await service().listCollections({}, 0);
    expect(rows.find((row) => row.label === "COL-00003")?.status).toBe("in_progress");
    expect(rows.find((row) => row.label === "COL-00002")?.status).toBe("in_progress");
  });

  it("filters by status, distributor and Douala day (Q-59g)", async () => {
    const mock = service();
    expect((await mock.listCollections({ status: "in_progress" }, 0)).rows.map((row) => row.label)).toEqual([
      "COL-00002",
      "COL-00003",
    ]);
    expect((await mock.listCollections({ distributorId: "dist-1" }, 0)).rows.map((row) => row.label)).toEqual(
      ["COL-00001"],
    );
    // COL-00001 was made at 07:00 on 3 October in Douala.
    expect(
      (await mock.listCollections({ from: "2026-10-03", to: "2026-10-03" }, 0)).rows.map((row) => row.label),
    ).toEqual(["COL-00001"]);
    expect((await mock.listCollections({ from: "2026-10-04" }, 0)).rows.map((row) => row.label)).toEqual([
      "COL-00002",
    ]);
    expect((await mock.listCollections({ to: "2026-10-02" }, 0)).rows.map((row) => row.label)).toEqual([
      "COL-00003",
    ]);
  });

  it("loads 25 at a time and says whether more follow", async () => {
    const mock = service((data) => {
      for (let n = 0; n < 27; n += 1) {
        data.collections.push({
          id: `x${String(n)}`,
          label: `COL-9${String(n)}`,
          createdAt: new Date(Date.UTC(2026, 8, 1, 0, n)).toISOString(),
          distributorId: "dist-1",
        });
        data.collectionItems.push({
          id: `xi${String(n)}`,
          collectionId: `x${String(n)}`,
          productId: "bb",
          unit: "Loaf",
          quantity: 10,
          loavesPerUnitSnapshot: 1,
        });
      }
    });
    const first = await mock.listCollections({}, 0);
    expect(first.rows).toHaveLength(PAGE_SIZE);
    expect(first.hasMore).toBe(true);
    const second = await mock.listCollections({}, PAGE_SIZE);
    expect(second.rows).toHaveLength(5);
    expect(second.hasMore).toBe(false);
  });

  it("COR-05: uses a correction, and marks it in the detail", async () => {
    const mock = service((data) => {
      data.corrections.push({
        targetTable: "collection_items",
        targetId: "ci2",
        field: "quantity",
        correctedValue: "11",
        createdAt: "2026-10-04T00:00:00Z",
      });
    });
    const row = (await mock.listCollections({}, 0)).rows.find((r) => r.label === "COL-00001");
    expect(row).toMatchObject({
      status: "in_progress",
      collected: [
        { productId: "bb", unit: "Loaf", quantity: 500 },
        { productId: "bb", unit: "Caisse", quantity: 11 },
      ],
    });
    const detail = await mock.getCollection("c1");
    expect(detail?.lines.find((line) => line.id === "ci2")).toMatchObject({
      quantity: 11,
      originalQuantity: 10,
      isCorrected: true,
      loaves: 550,
    });
  });

  it("the newest correction wins", async () => {
    const mock = service((data) => {
      data.corrections.push(
        {
          targetTable: "collection_items",
          targetId: "ci2",
          field: "quantity",
          correctedValue: "11",
          createdAt: "2026-10-04T00:00:00Z",
        },
        {
          targetTable: "collection_items",
          targetId: "ci2",
          field: "quantity",
          correctedValue: "10",
          createdAt: "2026-10-04T01:00:00Z",
        },
      );
    });
    expect((await mock.getCollection("c1"))?.lines.find((line) => line.id === "ci2")?.quantity).toBe(10);
  });
});

describe("getCollection (ADM-04)", () => {
  it("gives the lines, the balance per product in loaves, and the receipts newest first", async () => {
    const detail = await service().getCollection("c1");
    expect(detail?.collection.label).toBe("COL-00001");
    expect(detail?.lines.map((line) => [line.unit, line.quantity, line.loaves])).toEqual([
      ["Loaf", 500, 500],
      ["Caisse", 10, 500],
    ]);
    expect(detail?.balances).toEqual([
      { productId: "bb", collectedLoaves: 1000, distributedLoaves: 1000, remainingLoaves: 0 },
    ]);
    expect(detail?.receipts.map((receipt) => [receipt.label, receipt.depotName, receipt.status])).toEqual([
      ["DIS-00003", "Akwa", "awaiting_confirmation"],
      ["DIS-00002", "Bonaberi", "confirmed"],
      ["DIS-00001", "Akwa", "confirmed_with_discrepancy"],
    ]);
  });

  it("is null for a collection that does not exist", async () => {
    expect(await service().getCollection("nope")).toBeNull();
  });
});

describe("listReceipts (ADM-04, RCP-11)", () => {
  it("lists hand-overs newest first with their depot, collection and status", async () => {
    const { rows } = await service().listReceipts({}, 0);
    expect(rows.map((row) => row.label)).toEqual(["DIS-00004", "DIS-00003", "DIS-00002", "DIS-00001"]);
    expect(rows.find((row) => row.label === "DIS-00001")).toMatchObject({
      depotName: "Akwa",
      collectionLabel: "COL-00001",
      status: "confirmed_with_discrepancy",
      recorded: [
        { productId: "bb", unit: "Loaf", quantity: 100 },
        { productId: "bb", unit: "Caisse", quantity: 3 },
      ],
    });
    expect(rows.find((row) => row.label === "DIS-00004")).toMatchObject({
      status: "awaiting_confirmation",
      confirmedAt: null,
    });
  });

  it("filters by depot, receipt status and day (Q-59g)", async () => {
    const mock = service();
    expect((await mock.listReceipts({ depotId: "bonaberi" }, 0)).rows.map((row) => row.label)).toEqual([
      "DIS-00004",
      "DIS-00002",
    ]);
    expect(
      (await mock.listReceipts({ status: "confirmed_with_discrepancy" }, 0)).rows.map((row) => row.label),
    ).toEqual(["DIS-00001"]);
    expect(
      (await mock.listReceipts({ status: "awaiting_confirmation" }, 0)).rows.map((row) => row.label),
    ).toEqual(["DIS-00004", "DIS-00003"]);
    expect((await mock.listReceipts({ from: "2026-10-04" }, 0)).rows.map((row) => row.label)).toEqual([
      "DIS-00004",
    ]);
  });

  it("loads 25 at a time", async () => {
    const mock = service((data) => {
      for (let n = 0; n < 26; n += 1) {
        data.distributions.push({
          id: `y${String(n)}`,
          label: `DIS-9${String(n)}`,
          collectionId: "c1",
          depotId: "akwa",
          distributorId: "dist-1",
          createdAt: new Date(Date.UTC(2026, 8, 1, 0, n)).toISOString(),
        });
      }
    });
    expect((await mock.listReceipts({}, 0)).hasMore).toBe(true);
    expect((await mock.listReceipts({}, PAGE_SIZE)).rows).toHaveLength(5);
  });
});

describe("getReceipt (RCP-10, REC-02, RCP-06)", () => {
  it("2 Caisse + 5 Packs match 3 Caisse recorded; 95 Loaves against 100 is -5", async () => {
    const detail = await service().getReceipt("d1");
    expect(detail?.receipt.status).toBe("confirmed_with_discrepancy");
    expect(detail?.comment).toBe("Five crushed");
    const caisse = detail?.lines.find((line) => line.itemId === "di1");
    expect(caisse).toMatchObject({ recordedLoaves: 150, countedLoaves: 150, differenceLoaves: 0 });
    // Counts are listed Loaf, Pack, Caisse, the way the database service lists them.
    expect(caisse?.counts?.map((count) => [count.unit, count.quantity])).toEqual([
      ["Pack", 5],
      ["Caisse", 2],
    ]);
    expect(detail?.lines.find((line) => line.itemId === "di2")).toMatchObject({
      recordedLoaves: 100,
      countedLoaves: 95,
      differenceLoaves: -5,
    });
  });

  it("has no counts until the depot confirms", async () => {
    const detail = await service().getReceipt("d4");
    expect(detail?.receipt.status).toBe("awaiting_confirmation");
    expect(detail?.lines[0]).toMatchObject({ counts: null, countedLoaves: null, differenceLoaves: null });
    expect(detail?.comment).toBeNull();
  });

  it("COR-05: correcting a count to match makes the receipt Confirmed, and marks the count", async () => {
    const mock = service((data) => {
      data.corrections.push({
        targetTable: "confirmation_counts",
        targetId: "cc3",
        field: "quantity",
        correctedValue: "100",
        createdAt: "2026-10-04T00:00:00Z",
      });
    });
    const detail = await mock.getReceipt("d1");
    expect(detail?.receipt.status).toBe("confirmed");
    const line = detail?.lines.find((candidate) => candidate.itemId === "di2");
    expect(line?.differenceLoaves).toBe(0);
    expect(line?.counts?.[0]).toMatchObject({ quantity: 100, originalQuantity: 95, isCorrected: true });
  });

  it("COR-01: a corrected comment and a corrected recorded quantity are marked", async () => {
    const mock = service((data) => {
      data.corrections.push(
        {
          targetTable: "confirmations",
          targetId: "cf1",
          field: "comment",
          correctedValue: "Six crushed",
          createdAt: "2026-10-04T00:00:00Z",
        },
        {
          targetTable: "distribution_items",
          targetId: "di2",
          field: "quantity",
          correctedValue: "95",
          createdAt: "2026-10-04T00:00:00Z",
        },
      );
    });
    const detail = await mock.getReceipt("d1");
    expect(detail).toMatchObject({ comment: "Six crushed", commentIsCorrected: true });
    expect(detail?.lines.find((line) => line.itemId === "di2")).toMatchObject({
      recordedQuantity: 95,
      originalRecordedQuantity: 100,
      recordedIsCorrected: true,
      differenceLoaves: 0,
    });
  });

  it("is null for a hand-over that does not exist", async () => {
    expect(await service().getReceipt("nope")).toBeNull();
  });
});

describe("test helpers", () => {
  it("fails the next call once, then works", async () => {
    const mock = service();
    mock.failNextCallWith("unavailable");
    await expect(mock.listCollections({}, 0)).rejects.toEqual(new OperationsError("unavailable"));
    expect((await mock.listCollections({}, 0)).rows).toHaveLength(3);
  });

  it("holds the next call until released", async () => {
    const mock = service();
    const release = mock.holdNextCall();
    let done = false;
    const pending = mock.listReceipts({}, 0).then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    release();
    await pending;
    expect(done).toBe(true);
  });

  it("an empty mock has no rows", async () => {
    const mock = new MockOperationsService();
    expect((await mock.listCollections({}, 0)).rows).toEqual([]);
    expect(await mock.getCollection("x")).toBeNull();
  });
});
