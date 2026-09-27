/* the phone pane scrolled fully into view (the 390 viewport cuts the lower chart at its fold) */
import playwright from "/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/node_modules/playwright-core/index.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve, proxyApi, refuseOutside, newTally } from "./serve.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const roots = { before: process.argv[2], after: path.resolve(HERE, "../../../..") };
const browser = await playwright.chromium.launch({ headless: true });
for (const [tree, root] of Object.entries(roots)) {
  const { server, base } = await serve(root);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
  await proxyApi(ctx, newTally()); await refuseOutside(ctx, base);
  const page = await ctx.newPage();
  await page.goto(base + "/deck/index.html?scene=mag7", { waitUntil: "load" });
  await page.waitForTimeout(45000);
  let el = null;
  for (const f of page.frames()) if (/chart-v1/.test(f.url()) && await f.evaluate(() => (document.querySelector("#chartSlot .sc-nchart")?._series || []).length > 1).catch(() => false)) { el = await f.frameElement(); break; }
  await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(2500);
  await el.screenshot({ path: path.join(HERE, "..", "screens", `deck-mag7-390-${tree}-pane.png`) });
  console.log(tree, "ok");
  await ctx.close(); server.close();
}
await browser.close();
