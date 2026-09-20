import { SEED, WAREHOUSES } from "../seed";
import {
  BackendError,
  NotFoundError,
  type AdjustResult,
  type ItemInfo,
  type LowStockRow,
  type StockBackend,
} from "../types";

// The "Demo" backend: the seed catalogue with quantities kept in localStorage, so the app works
// with no server at all. It follows the same rules as the Supabase and ERPNext backends.

const KEY = "stockscan-demo:v1";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
type Levels = Record<string, Record<string, number>>; // item code -> warehouse -> quantity

const initialLevels = (): Levels =>
  Object.fromEntries(SEED.map((item) => [item.code, Object.fromEntries(item.stock.map((s) => [s.warehouse, s.qty]))]));

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function createMockBackend(storage: Storage | null = browserStorage()): StockBackend {
  const read = (): Levels => {
    try {
      const raw = storage?.getItem(KEY);
      if (raw) return JSON.parse(raw) as Levels;
    } catch {
      // unreadable storage: start from the seed
    }
    return initialLevels();
  };
  const write = (levels: Levels) => {
    try {
      storage?.setItem(KEY, JSON.stringify(levels));
    } catch {
      // storage full or blocked: the demo just won't remember
    }
  };

  const findItem = (code: string) => {
    const wanted = code.trim();
    return SEED.find((i) => i.barcode === wanted || i.code.toLowerCase() === wanted.toLowerCase());
  };
  const ruleFor = (itemCode: string, warehouse: string) =>
    SEED.find((i) => i.code === itemCode)?.stock.find((s) => s.warehouse === warehouse);

  const describe = (itemCode: string, scanned: string, levels: Levels): ItemInfo => {
    const item = SEED.find((i) => i.code === itemCode)!;
    const stock = Object.entries(levels[itemCode] ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([warehouse, qty]) => {
        const rule = ruleFor(itemCode, warehouse);
        return {
          warehouse,
          qty,
          reorder_level: rule?.level ?? null,
          reorder_qty: rule?.reorderQty ?? null,
          low: rule ? qty <= rule.level : false,
        };
      });
    return {
      item_code: item.code,
      item_name: item.name,
      stock_uom: "Nos",
      scanned,
      total_qty: stock.reduce((sum, s) => sum + s.qty, 0),
      low_stock: stock.some((s) => s.low),
      stock,
    };
  };

  return {
    id: "mock",
    label: "Demo (this browser)",

    async lookupItem(code) {
      if (!code.trim()) throw new BackendError("Scan or enter a barcode.");
      const item = findItem(code);
      if (!item) throw new NotFoundError(`No item found for ${code.trim()}.`);
      return describe(item.code, code, read());
    },

    async adjustStock(itemCode, warehouse, qty): Promise<AdjustResult> {
      if (!Number.isFinite(qty) || qty === 0) throw new BackendError("Quantity must not be zero.");
      const item = SEED.find((i) => i.code === itemCode);
      if (!item) throw new NotFoundError(`Item ${itemCode} does not exist.`);
      if (!(WAREHOUSES as readonly string[]).includes(warehouse)) {
        throw new NotFoundError(`Warehouse ${warehouse} does not exist.`);
      }

      const levels = read();
      const current = levels[itemCode]?.[warehouse] ?? 0;
      if (current + qty < 0) {
        throw new BackendError(`Not enough stock: ${item.name} has ${current} in ${warehouse}, cannot remove ${-qty}.`);
      }
      levels[itemCode] = { ...levels[itemCode], [warehouse]: current + qty };
      write(levels);
      return { item_code: itemCode, warehouse, change: qty, qty: current + qty };
    },

    async warehouses() {
      return [...WAREHOUSES];
    },

    async lowStock(): Promise<LowStockRow[]> {
      const levels = read();
      const rows: LowStockRow[] = [];
      for (const item of SEED) {
        for (const [warehouse, qty] of Object.entries(levels[item.code] ?? {})) {
          const rule = ruleFor(item.code, warehouse);
          if (rule && qty <= rule.level) {
            rows.push({
              item_code: item.code,
              item_name: item.name,
              warehouse,
              qty,
              reorder_level: rule.level,
              reorder_qty: rule.reorderQty,
            });
          }
        }
      }
      return rows.sort((a, b) => a.qty / a.reorder_level - b.qty / b.reorder_level);
    },

    async ping() {},

    async reset() {
      write(initialLevels());
    },
  };
}
