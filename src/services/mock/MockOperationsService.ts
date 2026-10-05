/**
 * In-memory OperationsService for tests and offline local development (ARCHITECTURE §7).
 *
 * WHY:  Page tests need records with known answers and no database. The mock
 *       derives everything the way the database views do (corrections applied,
 *       Remaining and both statuses computed in loaves), using the same domain
 *       functions, so a page that works here works against Supabase.
 * HOW:  Holds the raw records (collections, hand-overs, confirmations, counts,
 *       corrections, and the names of people and depots). Every read recomputes
 *       from them: the quantity in force is the newest correction, else the
 *       original (COR-05); receipt lines use `receiptLine`; statuses use `collectionStatus` and `receiptStatus`.
 *       Lists are newest first, filtered, 25 at a time. Helpers let tests fail or
 *       hold the next call.
 * WHEN: Tests, and `npm run dev` with VITE_DATA_SOURCE=mock.
 * SECURITY: Never deployed (services/index.ts selects it in development builds only).
 */
import {
  collectionBalances,
  collectionStatus,
  receiptLine,
  receiptStatus,
  type QuantityLine,
} from "@/domain/balances";
import { isAgedReceipt, isStaleCollection } from "@/domain/flags";
import { compareUnits, sumUnits, toLoaves } from "@/domain/units";
import { businessDay, dayRange } from "@/lib/format";
import {
  HOME_LIST_SIZE,
  OperationsError,
  PAGE_SIZE,
  type CollectionFilters,
  type OperationsErrorCode,
  type OperationsService,
  type Page,
  type ReceiptFilters,
} from "@/services/interfaces/OperationsService";
import type {
  CollectionDetail,
  CollectionLine,
  CollectionListItem,
  CountEntry,
  HomeData,
  ProductRemaining,
  ReceiptDetail,
  ReceiptLineDetail,
  ReceiptListItem,
  ProductQuantity,
} from "@/types/entities";
import type { Unit } from "@/types/enums";

interface Line {
  id: string;
  productId: string;
  unit: Unit;
  quantity: number;
  loavesPerUnitSnapshot: number;
}

/** The raw records the mock works from, in the shape of the database tables. */
export interface MockOperationsData {
  people: { id: string; fullName: string }[];
  depots: { id: string; name: string }[];
  collections: { id: string; label: string; createdAt: string; distributorId: string }[];
  collectionItems: (Line & { collectionId: string })[];
  distributions: {
    id: string;
    label: string;
    collectionId: string;
    depotId: string;
    distributorId: string;
    createdAt: string;
  }[];
  distributionItems: (Line & { distributionId: string })[];
  confirmations: {
    id: string;
    distributionId: string;
    managerId: string;
    comment: string | null;
    confirmedAt: string;
  }[];
  confirmationCounts: (Omit<Line, "productId"> & { confirmationId: string; itemId: string })[];
  corrections: {
    targetTable: "collection_items" | "distribution_items" | "confirmation_counts" | "confirmations";
    targetId: string;
    field: "quantity" | "comment";
    correctedValue: string;
    createdAt: string;
  }[];
}

export class MockOperationsService implements OperationsService {
  private nextFailure: OperationsErrorCode | null = null;
  private nextHold: Promise<void> | null = null;

  constructor(private readonly data: MockOperationsData = emptyData()) {}

  /** Makes the next call fail with `code`. */
  failNextCallWith(code: OperationsErrorCode): void {
    this.nextFailure = code;
  }

  /** Makes the next call wait until the returned function is called. */
  holdNextCall(): () => void {
    let release: (() => void) | undefined;
    this.nextHold = new Promise<void>((resolve) => {
      release = resolve;
    });
    return () => {
      release?.();
    };
  }

  async listCollections(filters: CollectionFilters, offset: number): Promise<Page<CollectionListItem>> {
    await this.beforeCall();
    const rows = this.data.collections
      .filter((c) => inDays(c.createdAt, filters.from, filters.to))
      .filter((c) => filters.distributorId === undefined || c.distributorId === filters.distributorId)
      .map((c) => this.collectionRow(c.id))
      .filter((row) => filters.status === undefined || row.status === filters.status);
    return page(rows, offset);
  }

  async getCollection(id: string): Promise<CollectionDetail | null> {
    await this.beforeCall();
    if (!this.data.collections.some((c) => c.id === id)) {
      return null;
    }
    const items = this.data.collectionItems.filter((item) => item.collectionId === id);
    const lines: CollectionLine[] = items
      .map((item) => {
        const quantity = this.effectiveQuantity("collection_items", item.id, item.quantity);
        return {
          id: item.id,
          productId: item.productId,
          unit: item.unit,
          quantity,
          originalQuantity: item.quantity,
          isCorrected: this.latestCorrection("collection_items", item.id, "quantity") !== undefined,
          loaves: toLoaves(quantity, item.loavesPerUnitSnapshot),
        };
      })
      .sort(compareUnits);
    const receipts = this.data.distributions
      .filter((d) => d.collectionId === id)
      .map((d) => this.receiptRow(d.id))
      .sort(newestFirst);
    return {
      collection: this.collectionRow(id),
      lines,
      receipts,
    };
  }

  async getHome(now: Date): Promise<HomeData> {
    await this.beforeCall();
    const { from, to } = dayRange(businessDay(now));
    const isToday = (instant: string) => instant >= from && instant < to;
    const collections = this.data.collections.map((c) => this.collectionRow(c.id)).sort(newestFirst);
    const receipts = this.data.distributions.map((d) => this.receiptRow(d.id)).sort(newestFirst);
    const today = collections.filter((c) => isToday(c.createdAt));
    const stale = collections.filter((c) => isStaleCollection(c.createdAt, c.status, now)).reverse();
    const aged = receipts.filter((r) => isAgedReceipt(r.createdAt, r.status, now)).reverse();
    const discrepancies = receipts.filter((r) => r.status === "confirmed_with_discrepancy");
    return {
      collectedToday: sumUnits(today.flatMap((c) => c.collected)),
      distributedToday: sumUnits(receipts.filter((r) => isToday(r.createdAt)).flatMap((r) => r.recorded)),
      remaining: this.remainingByProduct(),
      awaitingCount: receipts.filter((r) => r.status === "awaiting_confirmation").length,
      discrepancyCount: discrepancies.length,
      confirmedTodayCount: receipts.filter(
        (r) => r.status === "confirmed" && r.confirmedAt !== null && isToday(r.confirmedAt),
      ).length,
      todayCollections: today,
      latestDiscrepancies: discrepancies.slice(0, HOME_LIST_SIZE),
      staleCollections: { count: stale.length, rows: stale.slice(0, HOME_LIST_SIZE) },
      agedReceipts: { count: aged.length, rows: aged.slice(0, HOME_LIST_SIZE) },
    };
  }

  async listReceipts(filters: ReceiptFilters, offset: number): Promise<Page<ReceiptListItem>> {
    await this.beforeCall();
    const rows = this.data.distributions
      .filter((d) => inDays(d.createdAt, filters.from, filters.to))
      .filter((d) => filters.depotId === undefined || d.depotId === filters.depotId)
      .map((d) => this.receiptRow(d.id))
      .filter((row) => filters.status === undefined || row.status === filters.status);
    return page(rows, offset);
  }

  async getReceipt(id: string): Promise<ReceiptDetail | null> {
    await this.beforeCall();
    if (!this.data.distributions.some((d) => d.id === id)) {
      return null;
    }
    const confirmation = this.data.confirmations.find((c) => c.distributionId === id);
    const lines = this.data.distributionItems
      .filter((item) => item.distributionId === id)
      .map((item): ReceiptLineDetail => {
        const quantity = this.effectiveQuantity("distribution_items", item.id, item.quantity);
        const recordedLoaves = toLoaves(quantity, item.loavesPerUnitSnapshot);
        const counts = confirmation
          ? this.data.confirmationCounts
              .filter((count) => count.confirmationId === confirmation.id && count.itemId === item.id)
              .map((count): CountEntry => {
                const counted = this.effectiveQuantity("confirmation_counts", count.id, count.quantity);
                return {
                  unit: count.unit,
                  quantity: counted,
                  originalQuantity: count.quantity,
                  isCorrected:
                    this.latestCorrection("confirmation_counts", count.id, "quantity") !== undefined,
                };
              })
              .sort(compareUnits)
          : null;
        const result = confirmation
          ? receiptLine(recordedLoaves, this.countLines(confirmation.id, item.id))
          : null;
        return {
          itemId: item.id,
          productId: item.productId,
          unit: item.unit,
          recordedQuantity: quantity,
          originalRecordedQuantity: item.quantity,
          recordedIsCorrected: this.latestCorrection("distribution_items", item.id, "quantity") !== undefined,
          recordedLoaves,
          counts,
          countedLoaves: result?.countedLoaves ?? null,
          differenceLoaves: result?.differenceLoaves ?? null,
        };
      })
      .sort(compareUnits);
    const commentCorrection = confirmation
      ? this.latestCorrection("confirmations", confirmation.id, "comment")
      : undefined;
    return {
      receipt: this.receiptRow(id),
      lines,
      comment: commentCorrection?.correctedValue ?? confirmation?.comment ?? null,
      commentIsCorrected: commentCorrection !== undefined,
    };
  }

  // The newest correction of one field of one record, or undefined (COR-05: the latest wins).
  private latestCorrection(
    table: MockOperationsData["corrections"][number]["targetTable"],
    id: string,
    field: "quantity" | "comment",
  ) {
    return this.data.corrections
      .filter((c) => c.targetTable === table && c.targetId === id && c.field === field)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  }

  private effectiveQuantity(
    table: MockOperationsData["corrections"][number]["targetTable"],
    id: string,
    original: number,
  ): number {
    const correction = this.latestCorrection(table, id, "quantity");
    return correction ? Number(correction.correctedValue) : original;
  }

  // Lines with the quantity in force, for the domain functions.
  private quantityLines(table: "collection_items" | "distribution_items", items: Line[]): QuantityLine[] {
    return items.map((item) => ({
      productId: item.productId,
      quantity: this.effectiveQuantity(table, item.id, item.quantity),
      loavesPerUnitSnapshot: item.loavesPerUnitSnapshot,
    }));
  }

  private countLines(confirmationId: string, itemId: string): QuantityLine[] {
    return this.data.confirmationCounts
      .filter((count) => count.confirmationId === confirmationId && count.itemId === itemId)
      .map((count) => ({
        productId: "",
        quantity: this.effectiveQuantity("confirmation_counts", count.id, count.quantity),
        loavesPerUnitSnapshot: count.loavesPerUnitSnapshot,
      }));
  }

  // What was entered per product and unit, in Loaf, Pack, Caisse order (ADM-02).
  private perProduct(table: "collection_items" | "distribution_items", items: Line[]): ProductQuantity[] {
    const totals = new Map<string, ProductQuantity>();
    for (const item of items) {
      const key = `${item.productId}/${item.unit}`;
      const quantity = this.effectiveQuantity(table, item.id, item.quantity);
      const known = totals.get(key);
      totals.set(key, {
        productId: item.productId,
        unit: item.unit,
        quantity: (known?.quantity ?? 0) + quantity,
      });
    }
    return [...totals.values()].sort(compareUnits);
  }

  private name(list: { id: string; fullName?: string; name?: string }[], id: string): string | null {
    const found = list.find((entry) => entry.id === id);
    return found ? (found.fullName ?? found.name ?? null) : null;
  }

  // REC-01: loaves still to hand over, per product, across every collection; products with nothing left are left out.
  private remainingByProduct(): ProductRemaining[] {
    const totals = new Map<string, number>();
    for (const c of this.data.collections) {
      const items = this.data.collectionItems.filter((item) => item.collectionId === c.id);
      for (const balance of collectionBalances(
        this.quantityLines("collection_items", items),
        this.quantityLines("distribution_items", this.givenFrom(c.id)),
      )) {
        totals.set(balance.productId, (totals.get(balance.productId) ?? 0) + balance.remainingLoaves);
      }
    }
    return [...totals.entries()]
      .filter(([, remainingLoaves]) => remainingLoaves > 0)
      .map(([productId, remainingLoaves]) => ({ productId, remainingLoaves }));
  }

  // The hand-over lines taken from one collection.
  private givenFrom(collectionId: string) {
    return this.data.distributionItems.filter((item) =>
      this.data.distributions.some((d) => d.id === item.distributionId && d.collectionId === collectionId),
    );
  }

  // COL-08: In Progress while any product has loaves left to hand over; computed, never stored.
  private statusOf(collectionId: string): CollectionListItem["status"] {
    const items = this.data.collectionItems.filter((item) => item.collectionId === collectionId);
    return collectionStatus(
      collectionBalances(
        this.quantityLines("collection_items", items),
        this.quantityLines("distribution_items", this.givenFrom(collectionId)),
      ),
    );
  }

  private collectionRow(id: string): CollectionListItem {
    const c = this.data.collections.find((candidate) => candidate.id === id);
    if (!c) {
      throw new OperationsError("unavailable");
    }
    const items = this.data.collectionItems.filter((item) => item.collectionId === id);
    return {
      id,
      label: c.label,
      createdAt: c.createdAt,
      distributorId: c.distributorId,
      distributorName: this.name(this.data.people, c.distributorId),
      status: this.statusOf(id),
      collected: this.perProduct("collection_items", items),
    };
  }

  private receiptRow(id: string): ReceiptListItem {
    const d = this.data.distributions.find((candidate) => candidate.id === id);
    if (!d) {
      throw new OperationsError("unavailable");
    }
    const items = this.data.distributionItems.filter((item) => item.distributionId === id);
    const confirmation = this.data.confirmations.find((c) => c.distributionId === id);
    const lines = items.map((item) =>
      receiptLine(
        toLoaves(
          this.effectiveQuantity("distribution_items", item.id, item.quantity),
          item.loavesPerUnitSnapshot,
        ),
        confirmation ? this.countLines(confirmation.id, item.id) : [],
      ),
    );
    return {
      id,
      label: d.label,
      createdAt: d.createdAt,
      collectionId: d.collectionId,
      collectionLabel: this.data.collections.find((c) => c.id === d.collectionId)?.label ?? null,
      depotId: d.depotId,
      depotName: this.name(this.data.depots, d.depotId),
      distributorId: d.distributorId,
      distributorName: this.name(this.data.people, d.distributorId),
      status: receiptStatus(lines, confirmation !== undefined),
      confirmedAt: confirmation?.confirmedAt ?? null,
      recorded: this.perProduct("distribution_items", items),
    };
  }

  // Applies a pending hold or failure set by a test, once.
  private async beforeCall(): Promise<void> {
    if (this.nextHold) {
      const hold = this.nextHold;
      this.nextHold = null;
      await hold;
    }
    if (this.nextFailure) {
      const code = this.nextFailure;
      this.nextFailure = null;
      throw new OperationsError(code);
    }
  }
}

function emptyData(): MockOperationsData {
  return {
    people: [],
    depots: [],
    collections: [],
    collectionItems: [],
    distributions: [],
    distributionItems: [],
    confirmations: [],
    confirmationCounts: [],
    corrections: [],
  };
}

// Newest first, then by id, so the order is stable (the database orders the same way).
function newestFirst(a: { createdAt: string; id: string }, b: { createdAt: string; id: string }): number {
  return b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
}

// A Douala-day range filter, inclusive at both ends (Q-59g).
function inDays(createdAt: string, from?: string, to?: string): boolean {
  if (from !== undefined && createdAt < dayRange(from).from) {
    return false;
  }
  return to === undefined || createdAt < dayRange(to).to;
}

// One page of rows, with whether more follow.
function page<T extends { createdAt: string; id: string }>(rows: T[], offset: number): Page<T> {
  const sorted = [...rows].sort(newestFirst);
  return { rows: sorted.slice(offset, offset + PAGE_SIZE), hasMore: sorted.length > offset + PAGE_SIZE };
}
