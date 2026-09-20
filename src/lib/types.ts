// The shapes every backend returns. They match what the Inventory Hub ERPNext API sends,
// so the ERPNext adapter passes data straight through and the others copy the same format.

export interface StockRow {
  warehouse: string;
  qty: number;
  reorder_level: number | null;
  reorder_qty: number | null;
  /** Quantity is at or below the reorder level. */
  low: boolean;
}

export interface ItemInfo {
  item_code: string;
  item_name: string;
  stock_uom: string;
  /** The barcode or code that was looked up. */
  scanned: string;
  total_qty: number;
  low_stock: boolean;
  stock: StockRow[];
}

export interface AdjustResult {
  item_code: string;
  warehouse: string;
  change: number;
  /** Quantity on hand in that warehouse after the change. */
  qty: number;
  /** The document that recorded it, when the backend has one (an ERPNext Stock Entry). */
  reference?: string;
}

export interface LowStockRow {
  item_code: string;
  item_name: string;
  warehouse: string;
  qty: number;
  reorder_level: number;
  reorder_qty: number | null;
}

export type BackendId = "mock" | "supabase" | "erpnext";

export interface StockBackend {
  id: BackendId;
  label: string;
  /** Find an item by barcode or item code. Throws NotFoundError when there is none. */
  lookupItem(code: string): Promise<ItemInfo>;
  /** Positive qty adds stock, negative removes it. Throws when there isn't enough to remove. */
  adjustStock(itemCode: string, warehouse: string, qty: number, note?: string): Promise<AdjustResult>;
  warehouses(): Promise<string[]>;
  lowStock(): Promise<LowStockRow[]>;
  /** Throws if the backend can't be reached or the credentials are wrong. */
  ping(): Promise<void>;
  /** Put the demo data back (demo backends only). */
  reset?(): Promise<void>;
}

/** The barcode or item doesn't exist. Shown as "no match", not as an error. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Anything else that went wrong, with a message that is fit to show to the user. */
export class BackendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackendError";
  }
}
