/**
 * In-memory ProductService for tests and offline local development (ARCHITECTURE §7).
 *
 * WHY:  Tests need products without a database; the mock follows the same
 *       rules as admin_save_product so tests written against it hold for Supabase.
 * HOW:  An array of products. `save` refuses a duplicate code (ignoring case)
 *       and an unknown id, like the database. Helpers let tests fail or hold
 *       the next call to see error and loading states.
 * WHEN: Tests, and `npm run dev` with VITE_DATA_SOURCE=mock.
 * SECURITY: Never deployed (services/index.ts selects it in development builds only).
 */
import type { ProductSaveInput } from "@/domain/products";
import {
  ProductError,
  type ProductErrorCode,
  type ProductService,
} from "@/services/interfaces/ProductService";
import type { Product } from "@/types/entities";

export class MockProductService implements ProductService {
  private products: Product[];
  private nextFailure: ProductErrorCode | null = null;
  private nextHold: Promise<void> | null = null;
  private counter = 0;

  constructor(products: Product[] = []) {
    this.products = products.map((product) => ({ ...product }));
  }

  /** Makes the next call fail with `code`. */
  failNextCallWith(code: ProductErrorCode): void {
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

  async list(): Promise<Product[]> {
    await this.beforeCall();
    return [...this.products].sort((a, b) => a.name.localeCompare(b.name)).map((product) => ({ ...product }));
  }

  async get(id: string): Promise<Product | null> {
    await this.beforeCall();
    const found = this.products.find((product) => product.id === id);
    return found ? { ...found } : null;
  }

  async save(input: ProductSaveInput, id?: string): Promise<string> {
    await this.beforeCall();
    // RULE Q-57h: codes are unique ignoring letter case.
    const clash = this.products.some(
      (product) => product.code.toLowerCase() === input.code.toLowerCase() && product.id !== id,
    );
    if (clash) {
      throw new ProductError("code_taken");
    }
    if (id === undefined) {
      this.counter += 1;
      const created: Product = { id: `mock-product-${String(this.counter)}`, ...input };
      this.products.push(created);
      return created.id;
    }
    const index = this.products.findIndex((product) => product.id === id);
    if (index === -1) {
      throw new ProductError("not_found");
    }
    this.products[index] = { id, ...input };
    return id;
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
      throw new ProductError(code);
    }
  }
}
