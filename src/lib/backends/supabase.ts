import { createClient } from "@supabase/supabase-js";
import {
  BackendError,
  NotFoundError,
  type AdjustResult,
  type ItemInfo,
  type LowStockRow,
  type StockBackend,
} from "../types";

// Talks to the inv_* tables and functions from supabase/schema.sql. The browser never writes to
// the tables: every change goes through a function, which keeps stock from going negative.

export interface RpcClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;
}

export function createSupabaseClient(url: string, key: string): RpcClient {
  return createClient(url, key) as unknown as RpcClient;
}

export function createSupabaseBackend(client: RpcClient): StockBackend {
  async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await client.rpc(fn, args);
    if (error) {
      // P0002 (no_data_found) is what the SQL functions raise for an unknown barcode or item.
      if (error.code === "P0002") throw new NotFoundError(error.message);
      if (/failed to fetch|networkerror/i.test(error.message)) throw new BackendError("Can't reach Supabase. Check your connection.");
      throw new BackendError(error.message);
    }
    return data as T;
  }

  return {
    id: "supabase",
    label: "Supabase",

    lookupItem: (code) => rpc<ItemInfo>("inv_lookup_item", { p_code: code }),

    adjustStock: (itemCode, warehouse, qty, note) =>
      rpc<AdjustResult>("inv_adjust_stock", { p_item_code: itemCode, p_warehouse: warehouse, p_qty: qty, p_note: note ?? null }),

    warehouses: () => rpc<string[]>("inv_warehouses"),

    lowStock: () => rpc<LowStockRow[]>("inv_low_stock"),

    async ping() {
      await rpc("inv_warehouses");
    },

    async reset() {
      await rpc("inv_reset_demo");
    },
  };
}
