/* the stale state, on a real pane: the test browser's clock is set to Monday 28 Sep 11:00 ET, so the
   newest 30-minute bars (Friday's) are older than the last session that has opened. Only Date is moved. */
import playwright from "/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/node_modules/playwright-core/index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve, proxyApi, refuseOutside, newTally } from "./serve.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { server, base } = await serve(path.resolve(HERE, "../../../.."));
const browser = await playwright.chromium.launch({ headless: true });
for (const [label, when] of [["fresh", null], ["stale", "2026-09-28T15:00:00Z"]]) {
  const ctx = await browser.newContext({ viewport: { width: 419, height: 277 }, deviceScaleFactor: 3 });
  await proxyApi(ctx, newTally()); await refuseOutside(ctx, base);
  const page = await ctx.newPage();
  if (when) await page.clock.setFixedTime(new Date(when));
  await page.goto(base + "/station-shells/chart-v1?shell=v1&bare=1&t=MU&range=3D&view=auto&bubble=30m:3", { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector(".sc-nchart")?.dataset.lensState, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => { const h = document.querySelector(".sc-nchart"); return [h.dataset.lensState, document.querySelector(".sc-nchart__lens").getAttribute("aria-label")]; });
  console.log(label, st);
  await page.screenshot({ path: path.join(HERE, "..", "screens", `pane-MU-${label}.png`) });
  await ctx.close();
}
await browser.close(); server.close();
