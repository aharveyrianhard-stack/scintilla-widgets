/* K1 (5 Oct, SCI-13) — axis navigation on the Station chart, proved headless (never a visible window).
     node axis-proof.mjs <live|local>
   live = https://station.scintillahub.ai as deployed (BEFORE) · local = this branch served under the same hostname (AFTER).
   The chart API answers the Station's origin; every non-GET request is answered locally and counted, never sent.
   It drags the date strip left, then the price strip up, then double-clicks, and records the bars and the price range shown. */
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const mode = process.argv[2] || "local", here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, "../../.."), shots = path.join(here, "shots");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const writes = [], errors = [], out = { mode, at: new Date().toISOString(), writes, errors };
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
try {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 520 }, deviceScaleFactor: 2, serviceWorkers: "block" });
  await ctx.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { writes.push(m + " " + u.host + u.pathname); return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*" }, body: "[]" }); }
    if (mode === "local" && u.host === "station.scintillahub.ai" && !u.pathname.startsWith("/api/")) {
      let f = path.normalize(path.join(root, decodeURIComponent(u.pathname))); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
      if (!f.startsWith(root) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: "not found" });
      return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }, body: fs.readFileSync(f) });
    }
    return route.continue();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.length < 10 && errors.push(String(e.message).slice(0, 200)));
  await page.goto("https://station.scintillahub.ai/station-shells/chart-v1/?t=NVDA&range=1D&bare=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => { const h = document.querySelector(".sc-nchart"); return h && h._series && h._series.length > 20 && h._plot; }, null, { timeout: 60000 });
  await sleep(2500);
  const read = () => page.evaluate(() => { const h = document.querySelector(".sc-nchart"), p = h._plot, cv = h.querySelector(".sc-nchart__cv"), r = cv.getBoundingClientRect();
    return { bars: p.end - p.start, start: p.start, end: p.end, series: h._series.length, yLo: +p.yLo.toFixed(2), yHi: +p.yHi.toFixed(2), yRange: +(p.yHi - p.yLo).toFixed(2), yScale: h._yScale || 1, follow: h._followLatest !== false,
      box: { l: r.left, t: r.top, w: r.width, h: r.height }, plot: { padL: p.padL, padT: p.padT, iw: p.iw, ih: p.ih }, hasAxisCode: typeof chartAxisZoneOf === "function", cursor: cv.style.cursor || "" }; });
  const drag = async (x0, y0, x1, y1) => { await page.mouse.move(x0, y0); await page.mouse.down(); for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * i / 8); await page.mouse.up(); await sleep(500); };
  const s0 = await read(); out.start = s0;
  const b = s0.box, p = s0.plot, timeY = b.t + p.padT + p.ih + Math.min(10, (b.h - p.padT - p.ih) / 2), priceX = b.l + p.padL + p.iw + Math.min(18, (b.w - p.padL - p.iw) / 2), midX = b.l + p.padL + p.iw / 2, midY = b.t + p.padT + p.ih / 2;
  await page.screenshot({ path: path.join(shots, `axis-${mode}-0-start.png`) });
  await page.mouse.move(midX, timeY); await sleep(200); out.cursorOverDates = (await read()).cursor;
  await drag(midX, timeY, midX - p.iw / 2, timeY); out.afterDateStripLeft = await read();              // half a plot-width left: the span should double
  await page.screenshot({ path: path.join(shots, `axis-${mode}-1-dates-dragged-left.png`) });
  await drag(midX, timeY, midX + p.iw / 2, timeY); out.afterDateStripRight = await read();             // and back
  await page.mouse.move(priceX, midY); await sleep(200); out.cursorOverPrices = (await read()).cursor;
  await drag(priceX, midY, priceX, midY + p.ih / 2); out.afterPriceStripDown = await read();           // half a plot-height down: the range should double
  await page.screenshot({ path: path.join(shots, `axis-${mode}-2-prices-dragged-down.png`) });
  await drag(midX, midY, midX + 120, midY); out.afterChartDrag = await read();                         // a drag on the chart still pans
  await page.mouse.dblclick(midX, midY); await sleep(600); out.afterDoubleClick = await read();
  await page.screenshot({ path: path.join(shots, `axis-${mode}-3-double-click.png`) });
} catch (e) { out.failed = String((e && e.stack) || e).slice(0, 500); }
finally { await browser.close(); }
fs.writeFileSync(path.join(here, `axis-proof-${mode}.json`), JSON.stringify(out, null, 1));
const k = (s) => s ? `${s.bars} bars · price range ${s.yRange} · stretch ${(+s.yScale).toFixed(2)} · start ${s.start}` : "—";
console.log(mode, "errors", errors.length, "writes", writes.length, out.failed || "");
for (const key of ["start", "afterDateStripLeft", "afterDateStripRight", "afterPriceStripDown", "afterChartDrag", "afterDoubleClick"]) console.log("  ", key.padEnd(22), k(out[key]));
console.log("   cursor over dates:", out.cursorOverDates, "· over prices:", out.cursorOverPrices, "· axis code:", out.start && out.start.hasAxisCode);
