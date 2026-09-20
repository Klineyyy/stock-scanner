import { beforeEach, describe, expect, it } from "vitest";
import { BackendError, NotFoundError } from "../types";
import { createMockBackend } from "./mock";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("mock backend", () => {
  let storage: ReturnType<typeof fakeStorage>;
  let backend: ReturnType<typeof createMockBackend>;

  beforeEach(() => {
    storage = fakeStorage();
    backend = createMockBackend(storage);
  });

  it("finds an item by barcode with its stock per warehouse", async () => {
    const item = await backend.lookupItem("4800010000023");

    expect(item.item_code).toBe("PEN-BLU-12");
    expect(item.scanned).toBe("4800010000023");
    expect(item.total_qty).toBe(36);
    expect(item.low_stock).toBe(true); // 4 on the shelf, reorder level 6
    expect(item.stock).toEqual([
      { warehouse: "Display Shelf - DRC", qty: 4, reorder_level: 6, reorder_qty: 12, low: true },
      { warehouse: "Stores - DRC", qty: 32, reorder_level: 15, reorder_qty: 40, low: false },
    ]);
  });

  it("also accepts an item code, ignoring case and spaces", async () => {
    expect((await backend.lookupItem("  bond-a4 ")).item_name).toBe("Bond Paper A4 (ream)");
  });

  it("says 'not found' for an unknown barcode and rejects a blank one", async () => {
    await expect(backend.lookupItem("0000000000000")).rejects.toBeInstanceOf(NotFoundError);
    await expect(backend.lookupItem("   ")).rejects.toBeInstanceOf(BackendError);
  });

  it("adds and removes stock and reports the new quantity", async () => {
    expect(await backend.adjustStock("BOND-A4", "Stores - DRC", -30)).toMatchObject({ change: -30, qty: 15 });
    expect(await backend.adjustStock("BOND-A4", "Stores - DRC", 10)).toMatchObject({ change: 10, qty: 25 });
    expect((await backend.lookupItem("BOND-A4")).total_qty).toBe(25);
  });

  it("refuses to remove more than is on hand and leaves the stock alone", async () => {
    await expect(backend.adjustStock("ALC-500", "Stores - DRC", -4)).rejects.toThrow(/Not enough stock/);
    expect((await backend.lookupItem("ALC-500")).total_qty).toBe(3);
  });

  it("rejects a zero change and unknown items or warehouses", async () => {
    await expect(backend.adjustStock("BOND-A4", "Stores - DRC", 0)).rejects.toBeInstanceOf(BackendError);
    await expect(backend.adjustStock("NOPE", "Stores - DRC", 1)).rejects.toBeInstanceOf(NotFoundError);
    await expect(backend.adjustStock("BOND-A4", "Moon", 1)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("can receive an item into a warehouse it has never been in", async () => {
    await backend.adjustStock("STP-35", "Display Shelf - DRC", 5);

    const item = await backend.lookupItem("STP-35");
    expect(item.stock.map((s) => [s.warehouse, s.qty, s.reorder_level])).toEqual([
      ["Display Shelf - DRC", 5, null], // no reorder rule there, so never "low"
      ["Stores - DRC", 9, 5],
    ]);
  });

  it("lists what is running low, worst first, and updates as stock changes", async () => {
    const before = await backend.lowStock();
    expect(before.map((r) => `${r.item_code}@${r.warehouse}`).sort()).toEqual([
      "ALC-500@Stores - DRC",
      "MRK-BLK@Stores - DRC",
      "PEN-BLK-12@Stores - DRC",
      "PEN-BLU-12@Display Shelf - DRC",
      "TAPE-MSK@Stores - DRC",
    ]);
    expect(before[0].item_code).toBe("ALC-500"); // 3 of 10 is the furthest below its level

    await backend.adjustStock("BOND-A4", "Stores - DRC", -30); // 15, below its level of 20
    expect((await backend.lowStock()).some((r) => r.item_code === "BOND-A4")).toBe(true);

    await backend.adjustStock("BOND-A4", "Stores - DRC", 40);
    expect((await backend.lowStock()).some((r) => r.item_code === "BOND-A4")).toBe(false);
  });

  it("remembers changes in storage and puts the demo data back on reset", async () => {
    await backend.adjustStock("BOND-A4", "Stores - DRC", -5);
    expect((await createMockBackend(storage).lookupItem("BOND-A4")).total_qty).toBe(40); // a new instance, same storage

    await backend.reset!();
    expect((await backend.lookupItem("BOND-A4")).total_qty).toBe(45);
  });

  it("still works when storage is unavailable", async () => {
    const offline = createMockBackend(null);
    await offline.adjustStock("BOND-A4", "Stores - DRC", -5);
    expect((await offline.lookupItem("BOND-A4")).total_qty).toBe(45); // nothing was remembered, but nothing broke
  });
});
