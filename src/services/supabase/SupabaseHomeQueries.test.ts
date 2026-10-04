/**
 * Tests for the Supabase reads behind the admin Home (the client is faked; no network).
 *
 * Rules under test: ADM-02 (per unit as entered, summed in the app), Q-59c (today's
 * Douala day for the quantities and Confirmed; all open items for Awaiting and
 * Discrepancies), REC-01 (remaining per product), Q-59e (5 latest discrepancies),
 * COL-11 / RCP-15 / Q-59f (the 24-hour cut-offs), SEC-5 (rows are checked), and
 * "unavailable" instead of raw errors.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { SupabaseOperationsService } from "./SupabaseOperationsService";

import { OperationsError } from "@/services/interfaces/OperationsService";

type Call = [string, ...unknown[]];
interface Answer {
  data?: unknown;
  error?: unknown;
  count?: number;
}

// A query that records its calls and answers from a function of what was asked.
class FakeQuery {
  readonly calls: Call[] = [];

  constructor(
    private readonly table: string,
    private readonly answer: (table: string, calls: Call[]) => Answer,
    log: { table: string; calls: Call[] }[],
  ) {
    log.push({ table, calls: this.calls });
  }

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
  gt(...args: unknown[]) {
    return this.record("gt", args);
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
  then(resolve: (value: Answer) => unknown) {
    const { data = [], error = null, count } = this.answer(this.table, this.calls);
    return Promise.resolve({ data, error, count }).then(resolve);
  }
}

const NOW = new Date("2026-10-04T12:00:00Z");
// 4 October in Douala (UTC+1): 3 October 23:00 UTC up to, not including, 4 October 23:00 UTC.
const DAY_FROM = "2026-10-03T23:00:00.000Z";
const DAY_TO = "2026-10-04T23:00:00.000Z";

const has = (calls: Call[], name: string, column: string, value?: unknown) =>
  calls.some((c) => c[0] === name && c[1] === column && (value === undefined || c[2] === value));
const status = (calls: Call[]) => calls.find((c) => c[0] === "eq" && c[1] === "status")?.[2];

const COLLECTION_ROW = (id: string, lines: unknown[]) => ({
  id,
  label: `COL-${id}`,
  created_at: "2026-10-04T08:00:00+00:00",
  distributor_id: "dist-1",
  distributor_name: "Dan Distributor",
  status: "in_progress",
  collected_lines: lines,
});
const RECEIPT_ROW = (id: string, lines: unknown[], over: Record<string, unknown> = {}) => ({
  id,
  label: `DIS-${id}`,
  created_at: "2026-10-04T09:00:00+00:00",
  collection_id: "c1",
  collection_label: "COL-1",
  depot_id: "akwa",
  depot_name: "Akwa",
  distributor_id: "dist-1",
  distributor_name: "Dan Distributor",
  status: "awaiting_confirmation",
  confirmed_at: null,
  recorded_lines: lines,
  ...over,
});

function home(answer: (table: string, calls: Call[]) => Answer) {
  const log: { table: string; calls: Call[] }[] = [];
  const client = {
    from: (table: string) => new FakeQuery(table, answer, log),
  } as unknown as SupabaseClient;
  return { service: new SupabaseOperationsService(client), log };
}

// The default answers: today's rows, balances, counts, and one stale and one aged item.
function normal(table: string, calls: Call[]): Answer {
  if (table === "v_collection_list") {
    return has(calls, "eq", "status")
      ? { data: [COLLECTION_ROW("old", [{ product_id: "bb", unit: "Loaf", quantity: 80 }])], count: 3 }
      : {
          data: [
            COLLECTION_ROW("a", [
              { product_id: "bb", unit: "Loaf", quantity: 500 },
              { product_id: "bb", unit: "Caisse", quantity: 10 },
            ]),
            COLLECTION_ROW("b", [
              { product_id: "sb", unit: "Loaf", quantity: 100 },
              { product_id: "sb", unit: "Pack", quantity: 4 },
            ]),
          ],
        };
  }
  if (table === "v_collection_product_balance") {
    return {
      data: [
        { product_id: "bb", remaining_loaves: 100 },
        { product_id: "bb", remaining_loaves: 60 },
        { product_id: "sb", remaining_loaves: 25 },
      ],
    };
  }
  switch (status(calls)) {
    case "awaiting_confirmation":
      return has(calls, "lt", "created_at")
        ? { data: [RECEIPT_ROW("aged", [])], count: 2 }
        : { data: [], count: 7 };
    case "confirmed_with_discrepancy":
      return calls.some((c) => c[0] === "range")
        ? { data: [RECEIPT_ROW("bad", [], { status: "confirmed_with_discrepancy" })] }
        : { data: [], count: 4 };
    case "confirmed":
      return { data: [], count: 5 };
    default:
      return {
        data: [
          RECEIPT_ROW("x", [{ product_id: "bb", unit: "Loaf", quantity: 100 }]),
          RECEIPT_ROW("y", [
            { product_id: "bb", unit: "Loaf", quantity: 50 },
            { product_id: "sb", unit: "Pack", quantity: 3 },
          ]),
        ],
      };
  }
}

describe("getHome", () => {
  it("ADM-02: sums today's collected and handed-over quantities per unit as entered", async () => {
    const { service } = home(normal);
    const result = await service.getHome(NOW);
    expect(result.collectedToday).toEqual([
      { unit: "Loaf", quantity: 600 },
      { unit: "Pack", quantity: 4 },
      { unit: "Caisse", quantity: 10 },
    ]);
    expect(result.distributedToday).toEqual([
      { unit: "Loaf", quantity: 150 },
      { unit: "Pack", quantity: 3 },
    ]);
  });

  it("Q-6: asks for today's rows with the Douala day as the bounds", async () => {
    const { service, log } = home(normal);
    await service.getHome(NOW);
    const collections = log.find(
      (entry) => entry.table === "v_collection_list" && !has(entry.calls, "eq", "status"),
    );
    expect(collections?.calls).toContainEqual(["gte", "created_at", DAY_FROM]);
    expect(collections?.calls).toContainEqual(["lt", "created_at", DAY_TO]);
  });

  it("Q-59c: Awaiting and Discrepancies count all open items; Confirmed counts today's only", async () => {
    const { service, log } = home(normal);
    const result = await service.getHome(NOW);
    expect(result).toMatchObject({ awaitingCount: 7, discrepancyCount: 4, confirmedTodayCount: 5 });
    const reads = (wanted: string) =>
      log.filter((entry) => entry.table === "v_receipt_list" && status(entry.calls) === wanted);
    const confirmed = reads("confirmed")[0]?.calls ?? [];
    expect(confirmed).toContainEqual(["gte", "confirmed_at", DAY_FROM]);
    expect(confirmed).toContainEqual(["lt", "confirmed_at", DAY_TO]);
    const awaiting = reads("awaiting_confirmation").find((entry) => !has(entry.calls, "lt", "created_at"));
    expect(has(awaiting?.calls ?? [], "gte", "created_at")).toBe(false);
  });

  it("Q-59d: remaining per product is summed over every collection, in loaves", async () => {
    const { service } = home(normal);
    expect((await service.getHome(NOW)).remaining).toEqual([
      { productId: "bb", remainingLoaves: 160 },
      { productId: "sb", remainingLoaves: 25 },
    ]);
  });

  it("COL-11 / RCP-15 / Q-59f: asks for items older than 24 hours, oldest first, with their count", async () => {
    const { service, log } = home(normal);
    const result = await service.getHome(NOW);
    expect(result.staleCollections.count).toBe(3);
    expect(result.staleCollections.rows.map((row) => row.id)).toEqual(["old"]);
    expect(result.agedReceipts.count).toBe(2);
    expect(result.agedReceipts.rows.map((row) => row.id)).toEqual(["aged"]);
    const stale = log.find(
      (e) => e.table === "v_collection_list" && has(e.calls, "eq", "status", "in_progress"),
    );
    expect(stale?.calls).toContainEqual(["lt", "created_at", "2026-10-03T12:00:00.000Z"]);
    expect(stale?.calls).toContainEqual(["order", "created_at", { ascending: true }]);
    const aged = log.find(
      (e) => has(e.calls, "lt", "created_at", "2026-10-03T12:00:00.000Z") && e.table === "v_receipt_list",
    );
    expect(aged?.calls).toContainEqual(["range", 0, 4]);
  });

  it("Q-59e: reads the 5 latest discrepancies, newest first", async () => {
    const { service, log } = home(normal);
    const result = await service.getHome(NOW);
    expect(result.latestDiscrepancies.map((row) => row.id)).toEqual(["bad"]);
    const latest = log.find(
      (e) =>
        e.table === "v_receipt_list" &&
        status(e.calls) === "confirmed_with_discrepancy" &&
        e.calls.some((c) => c[0] === "range"),
    );
    expect(latest?.calls).toContainEqual(["order", "created_at", { ascending: false }]);
    expect(latest?.calls).toContainEqual(["range", 0, 4]);
  });

  it("fails as unavailable, without the database message, when any read fails", async () => {
    const { service } = home((table, calls) =>
      table === "v_collection_product_balance"
        ? { error: { message: "permission denied for view" } }
        : normal(table, calls),
    );
    const failure: unknown = await service.getHome(NOW).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(OperationsError);
    expect((failure as OperationsError).message).toBe("unavailable");
  });

  it("SEC-5: refuses a row it does not understand", async () => {
    const { service } = home((table, calls) =>
      table === "v_collection_product_balance"
        ? { data: [{ product_id: "bb", remaining_loaves: "lots" }] }
        : normal(table, calls),
    );
    await expect(service.getHome(NOW)).rejects.toBeInstanceOf(OperationsError);
  });

  it("is unavailable when a count does not come back", async () => {
    const { service } = home((table, calls) =>
      status(calls) === "confirmed" ? { data: [] } : normal(table, calls),
    );
    await expect(service.getHome(NOW)).rejects.toBeInstanceOf(OperationsError);
  });
});
