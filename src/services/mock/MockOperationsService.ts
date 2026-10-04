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
 *       original (COR-05); balances use `collectionBalances`; receipt lines use
 *       `receiptLine`; statuses use `collectionStatus` and `receiptStatus`.
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
import { compareUnits, toLoaves } from "@/domain/units";
import { dayRange } from "@/lib/format";
import {
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
  ReceiptDetail,
  ReceiptLineDetail,
  ReceiptListItem,
  UnitQuantity,
} from "@/types/entities";
import { UNITS, type Unit } from "@/types/enums";

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
    const given = this.data.distributionItems.filter((item) =>
      this.data.distributions.some((d) => d.id === item.distributionId && d.collectionId === id),
    );
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
      balances: collectionBalances(
        this.quantityLines("collection_items", items),
        this.quantityLines("distribution_items", given),
      ),
      receipts,
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

  // Quantities per unit as entered, in Loaf, Pack, Caisse order (ADM-02).
  private perUnit(table: "collection_items" | "distribution_items", items: Line[]): UnitQuantity[] {
    return UNITS.map((unit) => ({
      unit,
      quantity: items
        .filter((item) => item.unit === unit)
        .reduce((sum, item) => sum + this.effectiveQuantity(table, item.id, item.quantity), 0),
    })).filter((entry) => entry.quantity > 0 || items.some((item) => item.unit === entry.unit));
  }

  private name(list: { id: string; fullName?: string; name?: string }[], id: string): string | null {
    const found = list.find((entry) => entry.id === id);
    return found ? (found.fullName ?? found.name ?? null) : null;
  }

  private collectionRow(id: string): CollectionListItem {
    const c = this.data.collections.find((candidate) => candidate.id === id);
    if (!c) {
      throw new OperationsError("unavailable");
    }
    const items = this.data.collectionItems.filter((item) => item.collectionId === id);
    const given = this.data.distributionItems.filter((item) =>
      this.data.distributions.some((d) => d.id === item.distributionId && d.collectionId === id),
    );
    const balances = collectionBalances(
      this.quantityLines("collection_items", items),
      this.quantityLines("distribution_items", given),
    );
    return {
      id,
      label: c.label,
      createdAt: c.createdAt,
      distributorId: c.distributorId,
      distributorName: this.name(this.data.people, c.distributorId),
      status: collectionStatus(balances),
      collected: this.perUnit("collection_items", items),
      distributed: this.perUnit("distribution_items", given),
      remainingLoaves: balances.reduce((sum, balance) => sum + balance.remainingLoaves, 0),
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
      recorded: this.perUnit("distribution_items", items),
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
