/**
 * Tests for the Supabase ProductService (the Supabase client is faked; no network).
 *
 * Rules under test: rows become Products with Loaf implied (Q-57d); saves go
 * through admin_save_product with loaves only (PRD-05); database refusals
 * become plain codes (ARCHITECTURE §13).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { SupabaseProductService } from "./SupabaseProductService";

import { ProductError } from "@/services/interfaces/ProductService";

const ROW = {
  id: "p1",
  name: "Big Bread",
  code: "BB-01",
  description: "Large",
  status: "active",
  product_units: [
    { unit: "Loaf", loaves_per_unit: 1 },
    { unit: "Caisse", loaves_per_unit: 50 },
    { unit: "Pack", loaves_per_unit: 10 },
  ],
};
const PRODUCT = {
  id: "p1",
  name: "Big Bread",
  code: "BB-01",
  description: "Large",
  status: "active",
  packLoaves: 10,
  caisseLoaves: 50,
};
const INPUT = {
  name: "Big Bread",
  code: "BB-01",
  description: "Large",
  status: "active" as const,
  packLoaves: 10,
  caisseLoaves: null,
};

function fakeClient() {
  const maybeSingle = vi.fn().mockResolvedValue({ data: ROW, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const order = vi.fn().mockResolvedValue({ data: [ROW], error: null });
  const select = vi.fn().mockReturnValue({ order, eq });
  const client = {
    from: vi.fn().mockReturnValue({ select }),
    rpc: vi.fn().mockResolvedValue({ data: "p9", error: null }),
  };
  return {
    client,
    order,
    maybeSingle,
    eq,
    service: new SupabaseProductService(client as unknown as SupabaseClient),
  };
}

describe("SupabaseProductService", () => {
  it("lists products by name with their units", async () => {
    const { client, order, service } = fakeClient();
    expect(await service.list()).toEqual([PRODUCT]);
    expect(client.from).toHaveBeenCalledWith("products");
    expect(order).toHaveBeenCalledWith("name");
  });

  it("treats missing Pack/Caisse rows as not used", async () => {
    const { order, service } = fakeClient();
    order.mockResolvedValue({
      data: [{ ...ROW, product_units: [{ unit: "Loaf", loaves_per_unit: 1 }] }],
      error: null,
    });
    expect((await service.list())[0]).toMatchObject({ packLoaves: null, caisseLoaves: null });
  });

  it("Q-57j: shows a product without a description as an empty description", async () => {
    const { order, service } = fakeClient();
    order.mockResolvedValue({ data: [{ ...ROW, description: null }], error: null });
    expect((await service.list())[0]?.description).toBe("");
  });

  it("gets one product, or null", async () => {
    const { eq, maybeSingle, service } = fakeClient();
    expect(await service.get("p1")).toEqual(PRODUCT);
    expect(eq).toHaveBeenCalledWith("id", "p1");
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await service.get("nope")).toBeNull();
  });

  it("reports read failures and malformed rows as unavailable", async () => {
    const { order, maybeSingle, service } = fakeClient();
    order.mockResolvedValue({ data: null, error: { message: "x" } });
    await expect(service.list()).rejects.toEqual(new ProductError("unavailable"));
    maybeSingle.mockResolvedValue({ data: null, error: { message: "x" } });
    await expect(service.get("p1")).rejects.toEqual(new ProductError("unavailable"));
    maybeSingle.mockResolvedValue({ data: { ...ROW, status: "deleted" }, error: null });
    await expect(service.get("p1")).rejects.toEqual(new ProductError("unavailable"));
  });

  it("saves through admin_save_product (null id creates)", async () => {
    const { client, service } = fakeClient();
    expect(await service.save(INPUT)).toBe("p9");
    expect(client.rpc).toHaveBeenCalledWith("admin_save_product", {
      target_product_id: null,
      product_name: "Big Bread",
      product_code: "BB-01",
      product_description: "Large",
      product_status: "active",
      pack_loaves: 10,
      caisse_loaves: null,
    });
    await service.save(INPUT, "p1");
    expect(client.rpc).toHaveBeenLastCalledWith(
      "admin_save_product",
      expect.objectContaining({ target_product_id: "p1" }),
    );
  });

  it.each([
    ["CODE_TAKEN", "code_taken"],
    ["INVALID_PRODUCT", "invalid"],
    ["NOT_FOUND", "not_found"],
    ["NOT_ADMIN", "not_admin"],
    ["Failed to fetch", "unavailable"],
  ])("maps the database refusal %s to %s", async (message, code) => {
    const { client, service } = fakeClient();
    client.rpc.mockResolvedValue({ data: null, error: { message } });
    await expect(service.save(INPUT)).rejects.toEqual(new ProductError(code as ProductError["code"]));
  });

  it("treats an unexpected save answer as unavailable", async () => {
    const { client, service } = fakeClient();
    client.rpc.mockResolvedValue({ data: 42, error: null });
    await expect(service.save(INPUT)).rejects.toEqual(new ProductError("unavailable"));
  });
});
