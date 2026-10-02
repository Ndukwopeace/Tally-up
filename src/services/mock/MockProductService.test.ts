/**
 * Tests for the mock ProductService: it follows the database's rules so tests
 * built on it hold for Supabase (ARCHITECTURE §7).
 */
import { describe, expect, it } from "vitest";

import { MockProductService } from "./MockProductService";

import { ProductError } from "@/services/interfaces/ProductService";

const INPUT = {
  name: "Big Bread",
  code: "BB-01",
  description: "Large",
  status: "active" as const,
  packLoaves: 10,
  caisseLoaves: 50,
};

describe("MockProductService", () => {
  it("creates, lists by name, gets and edits products", async () => {
    const service = new MockProductService();
    const id = await service.save(INPUT);
    await service.save({ ...INPUT, name: "Apple Bun", code: "AB-1" });
    expect((await service.list()).map((product) => product.name)).toEqual(["Apple Bun", "Big Bread"]);
    expect(await service.get(id)).toEqual({ id, ...INPUT });
    await service.save({ ...INPUT, status: "inactive" }, id);
    expect((await service.get(id))?.status).toBe("inactive");
    expect(await service.get("missing")).toBeNull();
  });

  it("refuses a duplicate code ignoring case, but a product may keep its own code", async () => {
    const service = new MockProductService();
    const id = await service.save(INPUT);
    await expect(service.save({ ...INPUT, code: "bb-01" })).rejects.toEqual(new ProductError("code_taken"));
    await expect(service.save(INPUT, id)).resolves.toBe(id);
  });

  it("refuses to edit an unknown product", async () => {
    await expect(new MockProductService().save(INPUT, "nope")).rejects.toEqual(new ProductError("not_found"));
  });

  it("can fail or hold the next call", async () => {
    const service = new MockProductService([{ id: "p1", ...INPUT }]);
    service.failNextCallWith("unavailable");
    await expect(service.list()).rejects.toEqual(new ProductError("unavailable"));
    const release = service.holdNextCall();
    let done = false;
    const pending = service.list().then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    release();
    await pending;
    expect(done).toBe(true);
  });
});
