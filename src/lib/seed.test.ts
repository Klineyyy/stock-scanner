import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SEED, WAREHOUSES } from "./seed";

const sql = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");

function ean13IsValid(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const digits = [...code].map(Number);
  const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

describe("demo catalogue", () => {
  it("has valid EAN-13 barcodes, so a real scanner reads them", () => {
    for (const item of SEED) expect(ean13IsValid(item.barcode), `${item.code} ${item.barcode}`).toBe(true);
  });

  it("has unique codes and barcodes", () => {
    expect(new Set(SEED.map((i) => i.code)).size).toBe(SEED.length);
    expect(new Set(SEED.map((i) => i.barcode)).size).toBe(SEED.length);
  });

  it("matches the Inventory Hub ERPNext demo: 12 items and 410 units", () => {
    expect(SEED).toHaveLength(12);
    expect(SEED.flatMap((i) => i.stock).reduce((sum, s) => sum + s.qty, 0)).toBe(410);
  });

  it("is the same data as supabase/schema.sql (so the two backends agree)", () => {
    for (const item of SEED) {
      expect(sql, item.code).toContain(`('${item.code}',`);
      expect(sql, item.barcode).toContain(`'${item.barcode}'`);
      expect(sql, item.name).toContain(`'${item.name}'`);
      for (const s of item.stock) {
        const row = new RegExp(
          `\\('${item.code}',\\s*'${s.warehouse}',\\s*${s.qty},\\s*${s.level},\\s*${s.reorderQty}\\)`,
        );
        expect(sql, `${item.code} in ${s.warehouse}`).toMatch(row);
      }
    }
    for (const w of WAREHOUSES) expect(sql).toContain(`'${w}'`);
  });
});
