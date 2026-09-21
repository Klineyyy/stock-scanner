// End-to-end test of the Demo backend in a real browser, with a FAKE CAMERA: Chromium plays a video
// of a barcode instead of a real camera feed, so the whole scan flow (camera -> ZXing -> lookup ->
// stock change) runs for real.
//
//   npm run build && npm run preview        # terminal 1
//   python3 e2e/make-camera-videos.py       # once (needs: pip install python-barcode pillow)
//   npx playwright install chromium         # once
//   npm run e2e                             # terminal 2
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT ?? path.join(HERE, "screenshots");
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const step = (m) => console.log("ok -", m);
const errors = [];

async function session(video, fn, { camera = true, qr = false, viewport = { width: 390, height: 844 } } = {}) {
  const args = camera
    ? ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${HERE}/.cam/${video}.mjpeg`]
    : [];
  const browser = await chromium.launch({ args });
  const ctx = await browser.newContext({ viewport, hasTouch: true, permissions: camera ? ["camera"] : [] });
  if (qr) await ctx.addInitScript(() => localStorage.setItem("stockscan:settings", JSON.stringify({ backend: "mock", qr: true })));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${video}: ${e}`));
  page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && errors.push(`${video}: ${m.text()}`));
  page.on("console", (m) => m.type() === "warning" && /MultiFormatReader/.test(m.text()) && errors.push(`${video}: ZXing warning leaked: ${m.text().slice(0, 80)}`));
  try {
    await fn(page, ctx);
  } finally {
    await browser.close();
  }
}

const tid = (p, id) => p.locator(`[data-testid="${id}"]`);
const qtyInput = (p) => p.locator('ion-input[data-testid="qty"] input');
const toastText = (p, re) => p.getByText(re).first().waitFor({ timeout: 8000 });

// ---------- A. camera reads the Bond Paper barcode, then stock is changed ----------
await session("bond", async (page) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  assert.match(page.url(), /\/scan$/, "root redirects to /scan");
  step("app opens on the Scan tab");

  await tid(page, "scanner-status").waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="scanner-status"]')?.dataset.status === "scanning", null, { timeout: 15000 });
  step("camera started (fake camera stream)");

  await tid(page, "item-name").waitFor({ timeout: 20000 });
  assert.equal(await tid(page, "item-name").innerText(), "Bond Paper A4 (ream)");
  assert.equal((await tid(page, "total-qty").innerText()).trim(), "45");
  assert.equal(await tid(page, "low-badge").count(), 0);
  step("camera scanned 4800010000016 -> Bond Paper A4 (ream), 45 on hand, not low");
  await page.screenshot({ path: `${OUT}/scan-result.png` });

  // remove 30 -> 15, which is below the reorder level of 20
  await qtyInput(page).fill("30");
  await tid(page, "confirm").click();
  await toastText(page, /45 → 15 \(−30\)/);
  await page.waitForFunction(() => document.querySelector('[data-testid="total-qty"]')?.textContent.trim() === "15");
  await tid(page, "low-badge").waitFor();
  step("removing 30 updates the card to 15 and shows LOW STOCK");

  // more than is on hand is refused and changes nothing
  await qtyInput(page).fill("99");
  await tid(page, "confirm").click();
  await toastText(page, /Not enough stock/);
  assert.equal((await tid(page, "total-qty").innerText()).trim(), "15");
  step("removing 99 is refused with 'Not enough stock' and the quantity stays 15");

  // Add tab
  await tid(page, "mode-add").click();
  await qtyInput(page).fill("5");
  await tid(page, "confirm").click();
  await toastText(page, /15 → 20 \(\+5\)/);
  step("adding 5 works (15 -> 20)");

  // Low stock tab lists it
  await tid(page, "tab-alerts").click();
  await page.waitForSelector('[data-testid="alert-row"]');
  const rows = await page.locator('[data-testid="alert-row"]').allInnerTexts();
  assert.equal(rows.length, 6, `expected 6 low-stock rows, got ${rows.length}`);
  assert.ok(rows.some((r) => r.includes("Bond Paper A4")), "Bond Paper is on the low list");
  step("Low stock tab shows 6 items including Bond Paper (20 is at its reorder level)");
  await page.screenshot({ path: `${OUT}/alerts.png` });

  // History tab
  await tid(page, "tab-history").click();
  await page.waitForSelector('[data-testid="history-row"]');
  const hist = (await page.locator('[data-testid="history-row"]').allInnerTexts()).join("\n");
  assert.match(hist, /Scanned 4800010000016/);
  assert.match(hist, /45 → 15/);
  assert.match(hist, /15 → 20/);
  step("History tab records the scan and both changes");
  await page.screenshot({ path: `${OUT}/history.png` });

  // the camera must be off while another tab is showing, and back on when we return
  const cameraOff = () => page.evaluate(() => { const s = document.querySelector("video")?.srcObject; return !s || s.getTracks().every((t) => t.readyState === "ended"); });
  await page.waitForFunction(() => { const s = document.querySelector("video")?.srcObject; return !s || s.getTracks().every((t) => t.readyState === "ended"); }, null, { timeout: 5000 });
  assert.ok(await cameraOff(), "camera tracks stopped on the History tab");
  step("leaving the Scan tab switches the camera off");
  await tid(page, "tab-scan").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="scanner-status"]')?.dataset.status === "scanning", null, { timeout: 15000 });
  await page.waitForFunction(() => { const v = document.querySelector("video"); return v && v.videoWidth > 0 && v.srcObject?.getTracks().some((t) => t.readyState === "live"); }, null, { timeout: 10000 });
  step("returning to the Scan tab restarts the camera");

  // manual entry (what a hardware scanner does: types digits and presses Enter)
  await page.locator('ion-input[data-testid="manual"] input').fill("4800010000122");
  await page.locator('ion-input[data-testid="manual"] input').press("Enter");
  await page.waitForFunction(() => document.querySelector('[data-testid="item-name"]')?.textContent.includes("Alcohol"));
  assert.equal((await tid(page, "total-qty").innerText()).trim(), "3");
  await tid(page, "low-badge").waitFor();
  step("typing a barcode + Enter (hardware scanner) finds Alcohol, 3 left, LOW");

  await page.locator('ion-input[data-testid="manual"] input').fill("123");
  await page.locator('ion-input[data-testid="manual"] input').press("Enter");
  await tid(page, "not-found").waitFor();
  step("an unknown barcode shows 'No match'");

  // survives a reload (state is in localStorage)
  await page.reload({ waitUntil: "networkidle" });
  await tid(page, "tab-alerts").click();
  await page.waitForSelector('[data-testid="alert-row"]');
  assert.equal(await page.locator('[data-testid="alert-row"]').count(), 6);
  step("changes survive a page reload");

  // settings
  await tid(page, "tab-settings").click();
  await tid(page, "current-backend").waitFor();
  assert.equal(await tid(page, "current-backend").innerText(), "Demo (this browser)");
  await tid(page, "reset-demo").click();
  await toastText(page, /Demo data restored/);
  await tid(page, "tab-alerts").click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="alert-row"]').length === 5);
  step("Reset demo data puts it back to 5 low-stock items");

  await tid(page, "tab-settings").click();
  await tid(page, "backend-erpnext").click();
  await tid(page, "erp-url").waitFor();
  await tid(page, "test-connection").click();
  await toastText(page, /server address/);
  step("choosing ERPNext shows the connection form; testing with no address explains what's missing");
  await page.screenshot({ path: `${OUT}/settings.png` });

  // PWA
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.href;
    return href ? (await (await fetch(href)).json()) : null;
  });
  assert.equal(manifest?.short_name, "StockScan");
  assert.equal(manifest?.display, "standalone");
  const sw = await page.evaluate(async () => (await navigator.serviceWorker?.getRegistration())?.scope ?? null);
  assert.ok(sw, "service worker registered");
  step("PWA: manifest is valid (standalone, StockScan) and a service worker is registered");
});

// ---------- B. camera shows a barcode that is not in the catalogue ----------
await session("unknown", async (page) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await tid(page, "not-found").waitFor({ timeout: 20000 });
  assert.match(await tid(page, "not-found").innerText(), /9999999999994/);
  step("camera scan of an unknown barcode shows 'No match for 9999999999994'");
});

// ---------- C. a second barcode through the camera, on a desktop-sized window ----------
await session(
  "alcohol",
  async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await tid(page, "item-name").waitFor({ timeout: 20000 });
    assert.equal(await tid(page, "item-name").innerText(), "Alcohol 70% 500ml");
    await tid(page, "low-badge").waitFor();
    step("camera scan of a second barcode (Alcohol, LOW) works on a desktop window too");
    await page.screenshot({ path: `${OUT}/desktop.png` });
  },
  { viewport: { width: 1280, height: 800 } },
);

// ---------- D. no camera permission: a clear message, and typing still works ----------
await session(
  "none",
  async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForFunction(() => {
      const s = document.querySelector('[data-testid="scanner-status"]')?.dataset.status;
      return s && s !== "starting" && s !== "scanning";
    }, null, { timeout: 15000 });
    const status = await tid(page, "scanner-status").getAttribute("data-status");
    assert.ok(["denied", "no-camera", "error"].includes(status), `status was ${status}`);
    await page.locator('ion-input[data-testid="manual"] input').fill("4800010000016");
    await page.locator('ion-input[data-testid="manual"] input').press("Enter");
    await tid(page, "item-name").waitFor();
    step(`without a camera the app says so (${status}) and manual entry still works`);
    await page.screenshot({ path: `${OUT}/no-camera.png` });
  },
  { camera: false },
);

// ---------- E. QR codes are opt-in ----------
await session("qr", async (page) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector('[data-testid="scanner-status"]')?.dataset.status === "scanning", null, { timeout: 15000 });
  await page.waitForTimeout(5000);
  assert.equal(await tid(page, "item-name").count(), 0, "a QR code must be ignored while the setting is off");
  assert.doesNotMatch(await tid(page, "scanner-status").innerText(), /QR/);
  step("QR off (the default): a QR code held up to the camera is ignored");

  await tid(page, "tab-settings").click();
  await tid(page, "qr-toggle").click();
  await tid(page, "tab-scan").click();
  await tid(page, "item-name").waitFor({ timeout: 25000 });
  assert.equal(await tid(page, "item-name").innerText(), "Bond Paper A4 (ream)");
  assert.match(await tid(page, "scanner-status").innerText(), /QR code/);
  step("Settings > Also read QR codes on: the same QR code (holding BOND-A4) now finds Bond Paper A4 (ream)");

  await page.reload({ waitUntil: "networkidle" });
  await tid(page, "tab-settings").click();
  assert.equal(await page.locator('ion-toggle[data-testid="qr-toggle"]').evaluate((el) => el.checked), true);
  step("the QR setting is remembered after a reload");
});

// ---------- F. with QR on, ordinary product barcodes still work ----------
await session(
  "bond",
  async (page) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await tid(page, "item-name").waitFor({ timeout: 25000 });
    assert.equal(await tid(page, "item-name").innerText(), "Bond Paper A4 (ream)");
    assert.match(await tid(page, "scanner-status").innerText(), /QR code/);
    step("with QR on, an ordinary EAN-13 barcode is still read (Bond Paper A4 (ream))");
  },
  { qr: true },
);

console.log("page errors:", errors.length ? errors : "none");
if (errors.length) process.exit(1);
