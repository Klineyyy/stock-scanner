// Demo catalogue. It is the same 12 items, barcodes and quantities the Inventory Hub ERPNext demo
// loads, so the same barcode gives the same answer from every backend. supabase/schema.sql
// carries a copy; a test checks the two stay in sync.

export const WAREHOUSES = ["Stores - DRC", "Display Shelf - DRC"] as const;

export interface SeedStock {
  warehouse: (typeof WAREHOUSES)[number];
  qty: number;
  level: number;
  reorderQty: number;
}

export interface SeedItem {
  code: string;
  name: string;
  barcode: string;
  stock: SeedStock[];
}

const stores = (qty: number, level: number, reorderQty: number): SeedStock => ({
  warehouse: "Stores - DRC",
  qty,
  level,
  reorderQty,
});
const shelf = (qty: number, level: number): SeedStock => ({ warehouse: "Display Shelf - DRC", qty, level, reorderQty: 12 });

export const SEED: SeedItem[] = [
  { code: "BOND-A4", name: "Bond Paper A4 (ream)", barcode: "4800010000016", stock: [stores(45, 20, 60)] },
  { code: "PEN-BLU-12", name: "Ballpen Blue (box of 12)", barcode: "4800010000023", stock: [stores(32, 15, 40), shelf(4, 6)] },
  { code: "PEN-BLK-12", name: "Ballpen Black (box of 12)", barcode: "4800010000030", stock: [stores(6, 15, 40)] },
  { code: "MRK-BLK", name: "Marker Permanent Black", barcode: "4800010000047", stock: [stores(18, 24, 48)] },
  { code: "NB-80", name: "Notebook 80 Leaves", barcode: "4800010000054", stock: [stores(120, 30, 100), shelf(12, 5)] },
  { code: "STP-35", name: "Stapler No. 35", barcode: "4800010000061", stock: [stores(9, 5, 12)] },
  { code: "STPW-35", name: "Staple Wire No. 35 (box)", barcode: "4800010000078", stock: [stores(50, 20, 60)] },
  { code: "TAPE-MSK", name: "Masking Tape 1 inch", barcode: "4800010000085", stock: [stores(4, 12, 36)] },
  { code: "ENV-L50", name: "Envelope Long (pack of 50)", barcode: "4800010000092", stock: [stores(22, 10, 30)] },
  { code: "HL-YEL", name: "Highlighter Yellow", barcode: "4800010000108", stock: [stores(40, 20, 60), shelf(15, 6)] },
  { code: "CT-5MM", name: "Correction Tape 5mm", barcode: "4800010000115", stock: [stores(30, 12, 36)] },
  { code: "ALC-500", name: "Alcohol 70% 500ml", barcode: "4800010000122", stock: [stores(3, 10, 24)] },
];
