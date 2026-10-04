/**
 * Tests for the Supabase OperationsService (the Supabase client is faked; no network).
 *
 * Rules under test: lists read the list views newest first, 25 at a time, with the
 * Q-59g filters as query conditions (dates as Douala days, NFR-10); detail pages are
 * assembled from the views that apply corrections (COR-04, COR-05); every row is
 * checked before use (SEC-5); failures become "unavailable", never raw messages.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { SupabaseOperationsService } from "./SupabaseOperationsService";

import { OperationsError, PAGE_SIZE } from "@/services/interfaces/OperationsService";

// A query that records every call made on it and, when awaited, gives the result it was built with.
class FakeQuery {
  readonly calls: [string, ...unknown[]][] = [];

  constructor(private readonly result: { data: unknown; error: unknown }) {}

  private record(name: string, args: unknown[]): this {
    this.calls.push([name, ...args]);
    return this;
  }

  select(...args: unknown[]) {
    return this.record("select", args);
  }
  eq(...args: unknown[]) {
    return this.record("eq", args);
  }
  gte(...args: unknown[]) {
    return this.record("gte", args);
  }
  lt(...args: unknown[]) {
    return this.record("lt", args);
  }
  order(...args: unknown[]) {
    return this.record("order", args);
  }
  range(...args: unknown[]) {
    return this.record("range", args);
  }
  maybeSingle() {
    return this;
  }
  then(resolve: (value: { data: unknown; error: unknown }) => unknown) {
    return Promise.resolve(this.result).then(resolve);
  }
}

function clientWith(results: Record<string, { data: unknown; error?: unknown }>) {
  const queries = Object.fromEntries(
    Object.entries(results).map(([table, result]) => [
      table,
      new FakeQuery({ data: result.data, error: result.error ?? null }),
    ]),
  );
  const client = { from: (table: string) => queries[table] } as unknown as SupabaseClient;
  return { service: new SupabaseOperationsService(client), queries };
}

const COLLECTION_ROW = {
  id: "c1",
  number: 1,
  label: "COL-00001",
  created_at: "2026-10-03T06:00:00+00:00",
  distributor_id: "dist-1",
  distributor_name: "Dan Distributor",
  status: "in_progress",
  collected_lines: [
    { product_id: "bb", unit: "Loaf", quantity: 500 },
    { product_id: "bb", unit: "Caisse", quantity: 10 },
  ],
};
const COLLECTION = {
  id: "c1",
  label: "COL-00001",
  createdAt: "2026-10-03T06:00:00+00:00",
  distributorId: "dist-1",
  distributorName: "Dan Distributor",
  status: "in_progress",
  collected: [
    { productId: "bb", unit: "Loaf", quantity: 500 },
    { productId: "bb", unit: "Caisse", quantity: 10 },
  ],
};
const RECEIPT_ROW = {
  id: "d1",
  number: 1,
  label: "DIS-00001",
  created_at: "2026-10-03T08:00:00+00:00",
  collection_id: "c1",
  collection_label: "COL-00001",
  depot_id: "akwa",
  depot_name: "Akwa",
  distributor_id: "dist-1",
  distributor_name: "Dan Distributor",
  status: "confirmed_with_discrepancy",
  confirmed_at: "2026-10-03T10:00:00+00:00",
  recorded_lines: [{ product_id: "bb", unit: "Loaf", quantity: 100 }],
};
const RECEIPT = {
  id: "d1",
  label: "DIS-00001",
  createdAt: "2026-10-03T08:00:00+00:00",
  collectionId: "c1",
  collectionLabel: "COL-00001",
  depotId: "akwa",
  depotName: "Akwa",
  distributorId: "dist-1",
  distributorName: "Dan Distributor",
  status: "confirmed_with_discrepancy",
  confirmedAt: "2026-10-03T10:00:00+00:00",
  recorded: [{ productId: "bb", unit: "Loaf", quantity: 100 }],
};

describe("listCollections", () => {
  it("reads the list view newest first, 25 at a time, and maps the row", async () => {
    const { service, queries } = clientWith({ v_collection_list: { data: [COLLECTION_ROW] } });
    expect(await service.listCollections({}, 0)).toEqual({ rows: [COLLECTION], hasMore: false });
    expect(queries.v_collection_list?.calls).toEqual([
      ["select", "*"],
      ["order", "created_at", { ascending: false }],
      ["order", "id", { ascending: false }],
      ["range", 0, PAGE_SIZE],
    ]);
  });

  it("applies the filters: Douala days as UTC instants, distributor and status (Q-59g)", async () => {
    const { service, queries } = clientWith({ v_collection_list: { data: [] } });
    await service.listCollections(
      { from: "2026-10-03", to: "2026-10-04", distributorId: "dist-1", status: "in_progress" },
      25,
    );
    expect(queries.v_collection_list?.calls).toEqual(
      expect.arrayContaining([
        ["gte", "created_at", "2026-10-02T23:00:00.000Z"],
        ["lt", "created_at", "2026-10-04T23:00:00.000Z"],
        ["eq", "distributor_id", "dist-1"],
        ["eq", "status", "in_progress"],
        ["range", 25, 25 + PAGE_SIZE],
      ]),
    );
  });

  it("says there is more when it gets the extra row, and returns only 25", async () => {
    const rows = Array.from({ length: PAGE_SIZE + 1 }, (_, n) => ({
      ...COLLECTION_ROW,
      id: `c${String(n)}`,
    }));
    const { service } = clientWith({ v_collection_list: { data: rows } });
    const page = await service.listCollections({}, 0);
    expect(page.rows).toHaveLength(PAGE_SIZE);
    expect(page.hasMore).toBe(true);
  });

  it("says unavailable when the read fails or a row is not what was expected (SEC-5)", async () => {
    await expect(
      clientWith({ v_collection_list: { data: null, error: { message: "x" } } }).service.listCollections(
        {},
        0,
      ),
    ).rejects.toEqual(new OperationsError("unavailable"));
    await expect(
      clientWith({
        v_collection_list: { data: [{ ...COLLECTION_ROW, status: "weird" }] },
      }).service.listCollections({}, 0),
    ).rejects.toEqual(new OperationsError("unavailable"));
  });
});

describe("listReceipts", () => {
  it("reads the receipt list view and maps the row", async () => {
    const { service } = clientWith({ v_receipt_list: { data: [RECEIPT_ROW] } });
    expect(await service.listReceipts({}, 0)).toEqual({ rows: [RECEIPT], hasMore: false });
  });

  it("applies the depot, status and day filters", async () => {
    const { service, queries } = clientWith({ v_receipt_list: { data: [] } });
    await service.listReceipts({ from: "2026-10-03", depotId: "akwa", status: "awaiting_confirmation" }, 0);
    expect(queries.v_receipt_list?.calls).toEqual(
      expect.arrayContaining([
        ["gte", "created_at", "2026-10-02T23:00:00.000Z"],
        ["eq", "depot_id", "akwa"],
        ["eq", "status", "awaiting_confirmation"],
      ]),
    );
    expect(queries.v_receipt_list?.calls.some(([name]) => name === "lt")).toBe(false);
  });

  it("says unavailable when the read fails", async () => {
    await expect(
      clientWith({ v_receipt_list: { data: null, error: { message: "x" } } }).service.listReceipts({}, 0),
    ).rejects.toEqual(new OperationsError("unavailable"));
  });
});

describe("getCollection", () => {
  const tables = {
    v_collection_list: { data: COLLECTION_ROW },
    v_collection_items_effective: {
      data: [
        {
          id: "ci2",
          product_id: "bb",
          unit: "Caisse",
          quantity_original: 10,
          quantity_effective: 11,
          is_corrected: true,
          loaves: 550,
        },
        {
          id: "ci1",
          product_id: "bb",
          unit: "Loaf",
          quantity_original: 500,
          quantity_effective: 500,
          is_corrected: false,
          loaves: 500,
        },
      ],
    },
    v_collection_product_balance: {
      data: [{ product_id: "bb", collected_loaves: 1050, distributed_loaves: 450, remaining_loaves: 600 }],
    },
    v_receipt_list: { data: [RECEIPT_ROW] },
  };

  it("assembles the collection, its lines (Loaf first, corrected marked), balances and receipts", async () => {
    const detail = await clientWith(tables).service.getCollection("c1");
    expect(detail?.collection).toEqual(COLLECTION);
    expect(detail?.lines).toEqual([
      {
        id: "ci1",
        productId: "bb",
        unit: "Loaf",
        quantity: 500,
        originalQuantity: 500,
        isCorrected: false,
        loaves: 500,
      },
      {
        id: "ci2",
        productId: "bb",
        unit: "Caisse",
        quantity: 11,
        originalQuantity: 10,
        isCorrected: true,
        loaves: 550,
      },
    ]);
    expect(detail?.balances).toEqual([
      { productId: "bb", collectedLoaves: 1050, distributedLoaves: 450, remainingLoaves: 600 },
    ]);
    expect(detail?.receipts).toEqual([RECEIPT]);
  });

  it("is null when the collection is not visible or does not exist", async () => {
    expect(
      await clientWith({ ...tables, v_collection_list: { data: null } }).service.getCollection("x"),
    ).toBeNull();
  });

  it("says unavailable when any part fails", async () => {
    await expect(
      clientWith({
        ...tables,
        v_receipt_list: { data: null, error: { message: "x" } },
      }).service.getCollection("c1"),
    ).rejects.toEqual(new OperationsError("unavailable"));
  });
});

describe("getReceipt", () => {
  const tables = {
    v_receipt_list: { data: RECEIPT_ROW },
    v_distribution_items_effective: {
      data: [
        {
          id: "di2",
          product_id: "bb",
          unit: "Loaf",
          quantity_original: 100,
          quantity_effective: 100,
          is_corrected: false,
          loaves: 100,
        },
        {
          id: "di1",
          product_id: "bb",
          unit: "Caisse",
          quantity_original: 3,
          quantity_effective: 3,
          is_corrected: false,
          loaves: 150,
        },
      ],
    },
    v_receipt_line: {
      data: [
        { distribution_item_id: "di1", counted_loaves: 150, difference_loaves: 0 },
        { distribution_item_id: "di2", counted_loaves: 95, difference_loaves: -5 },
      ],
    },
    v_confirmations_effective: {
      data: { id: "cf1", comment_effective: "Five crushed", is_corrected: false },
    },
    v_confirmation_counts_effective: {
      data: [
        {
          distribution_item_id: "di1",
          unit: "Pack",
          quantity_original: 5,
          quantity_effective: 5,
          is_corrected: false,
        },
        {
          distribution_item_id: "di1",
          unit: "Caisse",
          quantity_original: 2,
          quantity_effective: 2,
          is_corrected: false,
        },
        {
          distribution_item_id: "di2",
          unit: "Loaf",
          quantity_original: 95,
          quantity_effective: 100,
          is_corrected: true,
        },
      ],
    },
  };

  it("assembles recorded, counted (in the units counted) and the difference in loaves for each line", async () => {
    const detail = await clientWith(tables).service.getReceipt("d1");
    expect(detail?.receipt).toEqual(RECEIPT);
    expect(detail?.comment).toBe("Five crushed");
    expect(detail?.lines.map((line) => line.itemId)).toEqual(["di2", "di1"]);
    expect(detail?.lines[1]).toMatchObject({
      recordedLoaves: 150,
      countedLoaves: 150,
      differenceLoaves: 0,
      counts: [
        { unit: "Pack", quantity: 5 },
        { unit: "Caisse", quantity: 2 },
      ],
    });
    expect(detail?.lines[0]).toMatchObject({
      differenceLoaves: -5,
      counts: [{ unit: "Loaf", quantity: 100, originalQuantity: 95, isCorrected: true }],
    });
  });

  it("has no counts until the depot confirms, and does not read them", async () => {
    const waiting = {
      ...tables,
      v_receipt_line: {
        data: [{ distribution_item_id: "di1", counted_loaves: null, difference_loaves: null }],
      },
      v_confirmations_effective: { data: null },
    };
    const { service, queries } = clientWith(waiting);
    const detail = await service.getReceipt("d1");
    expect(detail?.lines.every((line) => line.counts === null && line.countedLoaves === null)).toBe(true);
    expect(detail?.comment).toBeNull();
    expect(queries.v_confirmation_counts_effective?.calls).toEqual([]);
  });

  it("is null when the receipt is not visible or does not exist", async () => {
    expect(
      await clientWith({ ...tables, v_receipt_list: { data: null } }).service.getReceipt("x"),
    ).toBeNull();
  });

  it("says unavailable when any part fails, including the counts", async () => {
    await expect(
      clientWith({ ...tables, v_receipt_line: { data: null, error: { message: "x" } } }).service.getReceipt(
        "d1",
      ),
    ).rejects.toEqual(new OperationsError("unavailable"));
    await expect(
      clientWith({
        ...tables,
        v_confirmation_counts_effective: { data: null, error: { message: "x" } },
      }).service.getReceipt("d1"),
    ).rejects.toEqual(new OperationsError("unavailable"));
    await expect(
      clientWith({ ...tables, v_receipt_list: { data: { id: 5 } } }).service.getReceipt("d1"),
    ).rejects.toEqual(new OperationsError("unavailable"));
  });
});
