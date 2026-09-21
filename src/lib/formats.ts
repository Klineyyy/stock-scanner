import { BarcodeFormat } from "@zxing/library";

// The formats products carry. Restricting them makes decoding faster and avoids false reads.
export const PRODUCT_FORMATS: BarcodeFormat[] = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
];

/**
 * What the camera should look for. QR codes are opt-in (Settings > "Also read QR codes"): looking for
 * them makes every frame slower to decode, and ZXing's QR reader logs a warning on frames without one.
 */
export function scanFormats(readQr: boolean): BarcodeFormat[] {
  return readQr ? [...PRODUCT_FORMATS, BarcodeFormat.QR_CODE] : PRODUCT_FORMATS;
}
