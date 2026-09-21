// Checks the PWA parts in a real browser: the manifest and its icons, the service worker, and that the
// app really reloads and works with the network switched off (Demo backend).
//
//   npm run build && npm run preview     # terminal 1 (a build WITHOUT Supabase keys, so it starts on Demo)
//   npm run e2e:pwa                      # terminal 2
import { chromium } from "playwright";
import assert from "node:assert/strict";
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const step = (m) => console.log("ok -", m);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.goto(BASE, { waitUntil: "networkidle" });

// 1. manifest + icons
const m = await p.evaluate(async () => { const u = document.querySelector('link[rel="manifest"]').href; return { url: u, json: await (await fetch(u)).json() }; });
assert.equal(m.json.display, "standalone"); assert.equal(m.json.start_url, "/");
for (const icon of m.json.icons) {
  const r = await ctx.request.get(new URL(icon.src, BASE).href);
  assert.equal(r.status(), 200, icon.src); assert.match(r.headers()["content-type"], /image\/png/);
}
step(`manifest OK (standalone, ${m.json.icons.length} icons all load: ${m.json.icons.map((i) => i.sizes + (i.purpose ? "/" + i.purpose : "")).join(", ")})`);

// 2. service worker takes control
await p.evaluate(() => navigator.serviceWorker.ready);
await p.reload({ waitUntil: "networkidle" });
assert.ok(await p.evaluate(() => !!navigator.serviceWorker.controller), "service worker controls the page");
step("service worker is active and controlling the page");

// 3. go offline and reload
await ctx.setOffline(true);
await p.reload({ waitUntil: "domcontentloaded" });
await p.locator('[data-testid="tab-scan"]').waitFor({ timeout: 15000 });
step("OFFLINE: the app reloads and shows its tabs (served from the service worker cache)");

// 4. Demo backend keeps working with no network at all
await p.locator('ion-input[data-testid="manual"] input').fill("4800010000016");
await p.locator('ion-input[data-testid="manual"] input').press("Enter");
await p.locator('[data-testid="item-name"]').waitFor({ timeout: 10000 });
assert.equal(await p.locator('[data-testid="item-name"]').innerText(), "Bond Paper A4 (ream)");
await p.locator('ion-input[data-testid="qty"] input').fill("2");
await p.locator('[data-testid="confirm"]').click();
await p.getByText(/45 → 43/).first().waitFor({ timeout: 8000 });
step("OFFLINE: scanning by barcode and removing stock still work on the Demo backend (45 -> 43)");
await b.close();
