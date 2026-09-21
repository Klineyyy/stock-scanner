import { BarcodeFormat } from "@zxing/library";
import { describe, expect, it } from "vitest";
import { PRODUCT_FORMATS, scanFormats } from "./formats";

describe("scanFormats", () => {
  it("reads product barcodes only by default", () => {
    expect(scanFormats(false)).toEqual(PRODUCT_FORMATS);
    expect(scanFormats(false)).not.toContain(BarcodeFormat.QR_CODE);
    expect(scanFormats(false)).toContain(BarcodeFormat.EAN_13);
  });

  it("adds QR codes on top of the product barcodes when asked", () => {
    const formats = scanFormats(true);
    expect(formats).toContain(BarcodeFormat.QR_CODE);
    for (const f of PRODUCT_FORMATS) expect(formats).toContain(f);
  });

  it("doesn't change the default list when QR is on", () => {
    scanFormats(true);
    expect(PRODUCT_FORMATS).not.toContain(BarcodeFormat.QR_CODE);
  });
});
