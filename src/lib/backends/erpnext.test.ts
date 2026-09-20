import { describe, expect, it, vi } from "vitest";
import { BackendError, NotFoundError } from "../types";
import { createErpnextBackend, parseFrappeError } from "./erpnext";

const config = { url: "http://erp.test:8080/", key: "k", secret: "s" };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

// What Frappe really sends: _server_messages is a JSON string holding JSON strings.
const frappeError = (message: string, excType: string) => ({
  exc_type: excType,
  exception: `frappe.exceptions.${excType}: ${message}`,
  _server_messages: JSON.stringify([JSON.stringify({ message, title: "Message", indicator: "red" })]),
});

describe("parseFrappeError", () => {
  it("reads the server message and strips HTML", () => {
    const body = { _server_messages: JSON.stringify([JSON.stringify({ message: "<b>Needed</b> 5 units" })]) };
    expect(parseFrappeError(417, body)).toBe("Needed 5 units");
  });

  it("falls back to the exception text, then to a generic sentence", () => {
    expect(parseFrappeError(417, { exception: "frappe.exceptions.ValidationError: Quantity must not be zero." })).toBe(
      "Quantity must not be zero.",
    );
    expect(parseFrappeError(500, null)).toMatch(/HTTP 500/);
  });
});

describe("erpnext backend", () => {
  it("looks an item up with the token header and returns it as is", async () => {
    const item = { item_code: "BOND-A4", item_name: "Bond", stock_uom: "Nos", scanned: "480", total_qty: 45, low_stock: false, stock: [] };
    const fetchImpl = vi.fn().mockResolvedValue(json({ message: item }));

    const result = await createErpnextBackend(config, fetchImpl).lookupItem("4800010000016");

    expect(result).toEqual(item);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://erp.test:8080/api/method/inventory_hub.api.lookup_item?code=4800010000016"); // no double slash
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("token k:s");
  });

  it("maps a Frappe 'does not exist' to NotFoundError", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(frappeError("No item found for 999.", "DoesNotExistError"), 404));

    await expect(createErpnextBackend(config, fetchImpl).lookupItem("999")).rejects.toThrow(NotFoundError);
  });

  it("explains a rejected key, an unreachable server and a wrong address", async () => {
    const denied = createErpnextBackend(config, vi.fn().mockResolvedValue(json({}, 403)));
    await expect(denied.lookupItem("1")).rejects.toThrow(/API key or secret/);

    const down = createErpnextBackend(config, vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(down.lookupItem("1")).rejects.toThrow(/Can't reach the ERPNext server/);

    const notErp = createErpnextBackend(config, vi.fn().mockResolvedValue(new Response("<html>Not found</html>", { status: 404 })));
    await expect(notErp.lookupItem("1")).rejects.toThrow(/doesn't look like an ERPNext server/);
  });

  it("asks for an address when none is set, without calling the network", async () => {
    const fetchImpl = vi.fn();
    await expect(createErpnextBackend({ ...config, url: " " }, fetchImpl).ping()).rejects.toThrow(/server address/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts a stock change as a form and returns the Stock Entry as the reference", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(json({ message: { stock_entry: "MAT-STE-1", item_code: "BOND-A4", warehouse: "Stores - DRC", change: -5, qty: 40 } }));

    const result = await createErpnextBackend(config, fetchImpl).adjustStock("BOND-A4", "Stores - DRC", -5, "sold");

    expect(result).toEqual({ item_code: "BOND-A4", warehouse: "Stores - DRC", change: -5, qty: 40, reference: "MAT-STE-1" });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://erp.test:8080/api/method/inventory_hub.api.adjust_stock");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(init.body)).toEqual({ item_code: "BOND-A4", warehouse: "Stores - DRC", qty: "-5", note: "sold" });
  });

  it("shows ERPNext's own message when it refuses a stock change", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(frappeError("5 units of Bond needed in Stores.", "NegativeStockError"), 417));

    await expect(createErpnextBackend(config, fetchImpl).adjustStock("BOND-A4", "Stores - DRC", -99)).rejects.toThrow(
      new BackendError("5 units of Bond needed in Stores."),
    );
  });

  it("maps warehouses and low-stock alerts to the app's shapes", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ message: [{ name: "Stores - DRC" }, { name: "Display Shelf - DRC" }] }))
      .mockResolvedValueOnce(
        json({ message: [{ item_code: "ALC-500", item_name: "Alcohol", warehouse: "Stores - DRC", actual_qty: 3, reorder_level: 10, reorder_qty: 24 }] }),
      );
    const backend = createErpnextBackend(config, fetchImpl);

    expect(await backend.warehouses()).toEqual(["Stores - DRC", "Display Shelf - DRC"]);
    expect(await backend.lowStock()).toEqual([
      { item_code: "ALC-500", item_name: "Alcohol", warehouse: "Stores - DRC", qty: 3, reorder_level: 10, reorder_qty: 24 },
    ]);
  });
});
