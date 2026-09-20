import { describe, expect, it, vi } from "vitest";
import { BackendError, NotFoundError } from "../types";
import { createSupabaseBackend, type RpcClient } from "./supabase";

type Reply = { data: unknown; error: { code?: string; message: string } | null };
const ok = (data: unknown): Reply => ({ data, error: null });
const fail = (message: string, code?: string): Reply => ({ data: null, error: { message, code } });

function backendReturning(...responses: Reply[]) {
  const rpc = vi.fn();
  responses.forEach((r) => rpc.mockResolvedValueOnce(r));
  return { backend: createSupabaseBackend({ rpc } as RpcClient), rpc };
}

describe("supabase backend", () => {
  it("calls the right function with the right arguments", async () => {
    const item = { item_code: "BOND-A4", stock: [] };
    const { backend, rpc } = backendReturning(ok(item), ok({ qty: 40 }), ok(["Stores - DRC"]), ok([]));

    expect(await backend.lookupItem("4800010000016")).toEqual(item);
    await backend.adjustStock("BOND-A4", "Stores - DRC", -5, "sold");
    await backend.warehouses();
    await backend.lowStock();

    expect(rpc.mock.calls).toEqual([
      ["inv_lookup_item", { p_code: "4800010000016" }],
      ["inv_adjust_stock", { p_item_code: "BOND-A4", p_warehouse: "Stores - DRC", p_qty: -5, p_note: "sold" }],
      ["inv_warehouses", undefined],
      ["inv_low_stock", undefined],
    ]);
  });

  it("sends a missing note as null", async () => {
    const { backend, rpc } = backendReturning(ok({ qty: 1 }));
    await backend.adjustStock("BOND-A4", "Stores - DRC", 1);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_note: null });
  });

  it("treats the no_data_found code as 'not found' and other errors as failures", async () => {
    const missing = backendReturning(fail("No item found for 999.", "P0002")).backend;
    await expect(missing.lookupItem("999")).rejects.toBeInstanceOf(NotFoundError);

    const tooMuch = backendReturning(fail("Not enough stock: Alcohol has 3 in Stores, cannot remove 4.", "P0001")).backend;
    await expect(tooMuch.adjustStock("ALC-500", "Stores - DRC", -4)).rejects.toThrow(
      new BackendError("Not enough stock: Alcohol has 3 in Stores, cannot remove 4."),
    );
  });

  it("gives a friendly message when the network is down", async () => {
    const { backend } = backendReturning(fail("TypeError: Failed to fetch"));
    await expect(backend.ping()).rejects.toThrow(/Can't reach Supabase/);
  });
});
