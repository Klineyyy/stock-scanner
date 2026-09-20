import {
  BackendError,
  NotFoundError,
  type AdjustResult,
  type ItemInfo,
  type LowStockRow,
  type StockBackend,
} from "../types";

// Talks to the Inventory Hub app on an ERPNext server (github.com/Klineyyy/inventory-hub).
// Its API already returns the shapes in ../types, so most calls pass straight through.

export interface ErpConfig {
  url: string;
  key: string;
  secret: string;
}

/** Turn a failed Frappe response into a sentence a person can read. */
export function parseFrappeError(status: number, body: unknown): string {
  const data = (body ?? {}) as { _server_messages?: string; exception?: string; exc_type?: string };

  if (typeof data._server_messages === "string") {
    try {
      const messages = (JSON.parse(data._server_messages) as string[])
        .map((m) => (JSON.parse(m) as { message?: string }).message ?? "")
        .map((m) => m.replace(/<[^>]*>/g, "").trim())
        .filter(Boolean);
      if (messages.length) return messages.join(" ");
    } catch {
      // fall through to the exception text
    }
  }
  if (typeof data.exception === "string") return data.exception.split(": ").slice(1).join(": ") || data.exception;
  return `The server answered with an error (HTTP ${status}).`;
}

export function createErpnextBackend(config: ErpConfig, fetchImpl: typeof fetch = (...a) => fetch(...a)): StockBackend {
  const base = config.url.trim().replace(/\/+$/, "");

  async function call<T>(method: string, args: { query?: Record<string, string>; form?: Record<string, string> } = {}): Promise<T> {
    if (!base) throw new BackendError("Enter the ERPNext server address in Settings.");

    const url = `${base}/api/method/inventory_hub.api.${method}${args.query ? `?${new URLSearchParams(args.query)}` : ""}`;
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: args.form ? "POST" : "GET",
        headers: {
          Authorization: `token ${config.key.trim()}:${config.secret.trim()}`,
          ...(args.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        body: args.form ? new URLSearchParams(args.form) : undefined,
      });
    } catch {
      throw new BackendError(
        "Can't reach the ERPNext server. Check the address, and that the server allows requests from this app (CORS).",
      );
    }

    if (res.ok) return ((await res.json()) as { message: T }).message;

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // not JSON: probably not an ERPNext server at all
    }
    if (res.status === 401 || res.status === 403) throw new BackendError("ERPNext rejected the API key or secret.");
    if (res.status === 404 && (body as { exc_type?: string } | null)?.exc_type === "DoesNotExistError") {
      throw new NotFoundError(parseFrappeError(res.status, body));
    }
    if (body === null) throw new BackendError("That address doesn't look like an ERPNext server with Inventory Hub installed.");
    throw new BackendError(parseFrappeError(res.status, body));
  }

  return {
    id: "erpnext",
    label: "ERPNext",

    lookupItem: (code) => call<ItemInfo>("lookup_item", { query: { code } }),

    async adjustStock(itemCode, warehouse, qty, note): Promise<AdjustResult> {
      const result = await call<{ stock_entry: string } & AdjustResult>("adjust_stock", {
        form: { item_code: itemCode, warehouse, qty: String(qty), ...(note ? { note } : {}) },
      });
      return {
        item_code: result.item_code,
        warehouse: result.warehouse,
        change: result.change,
        qty: result.qty,
        reference: result.stock_entry,
      };
    },

    async warehouses() {
      const rows = await call<{ name: string }[]>("warehouses");
      return rows.map((w) => w.name);
    },

    async lowStock(): Promise<LowStockRow[]> {
      const rows = await call<
        { item_code: string; item_name: string; warehouse: string; actual_qty: number; reorder_level: number; reorder_qty: number | null }[]
      >("low_stock");
      return rows.map((r) => ({
        item_code: r.item_code,
        item_name: r.item_name,
        warehouse: r.warehouse,
        qty: r.actual_qty,
        reorder_level: r.reorder_level,
        reorder_qty: r.reorder_qty,
      }));
    },

    async ping() {
      await call("warehouses");
    },
  };
}
