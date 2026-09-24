/* M69 · THE PROOF: SCRATCH, TO-DO, INTERNALS and the timeframe label, in a real browser.
 *
 * Headless always (Alan's screen is never taken). Everything off this Mac is controlled and
 * disclosed:
 *   · the chart API is PROXIED through this script, which adds the Origin header the API
 *     accepts (https://scintillahub.ai) — the bars in these pictures are real, live bars;
 *   · the Hub's symbol list is STUBBED with the handful of symbols typed here, because the
 *     Supabase read needs no proof for this change and a stub keeps the run offline;
 *   · s.tradingview.com is allowed, because whether those four panes are grey or coloured is
 *     exactly what TO-DO is here to show;
 *   · every other off-origin request is aborted.
 *
 * usage: node station-scratch-shots.mjs [width...]
 */
import playwright from "/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/node_modules/playwright-core/index.js";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const OUT = path.join(ROOT, "deliverables/20260924/station-scratch/shots");
fs.mkdirSync(OUT, { recursive: true });
const MIME = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".mjs":"text/javascript; charset=utf-8", ".css":"text/css", ".json":"application/json",
  ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon" };
const srv = http.createServer((q, r) => {
  let rel = decodeURIComponent(new URL(q.url, "http://x").pathname).replace(/^\/+/, "") || "index.html";
  try { if (fs.statSync(path.join(ROOT, rel)).isDirectory()) rel += "/index.html"; } catch (_) {}
  try {
    const b = fs.readFileSync(path.join(ROOT, rel));
    r.writeHead(200, { "content-type": MIME[path.extname(rel)] || "application/octet-stream", "cache-control":"no-store" });
    r.end(b);
  } catch (_) { r.writeHead(404); r.end("no"); }
});
await new Promise((res) => srv.listen(0, "127.0.0.1", res));
const ORIGIN = `http://127.0.0.1:${srv.address().port}`;

const TICKERS = ["SPY","QQQ","NVDA","MU","AAPL","TSLA","SNDK","IWM","VIX","PCC"];
const CATALOGUE = JSON.stringify(TICKERS.map((t) => ({ ticker:t, type:"equity", cohort:"TEST" })));

const browser = await playwright.chromium.launch({ headless: true });
const widths = (process.argv.slice(2).map(Number).filter(Boolean));
const WIDTHS = widths.length ? widths : [1680, 390];
const seen = [];

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 780 : 1000 }, deviceScaleFactor: 1 });
  let proxied = 0, blocked = 0;
  await ctx.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN)) return route.continue();
    if (url.includes("scintilla-massive-chart-api.fly.dev")) {
      proxied += 1;
      try {
        const upstream = await fetch(url, { headers: { origin: "https://scintillahub.ai", accept: "application/json" } });
        const body = Buffer.from(await upstream.arrayBuffer());
        return route.fulfill({ status: upstream.status, body,
          headers: { "content-type": upstream.headers.get("content-type") || "application/json",
                     "access-control-allow-origin": "*" } });
      } catch (e) { return route.fulfill({ status: 502, body: "proxy failed" }); }
    }
    if (url.includes("/rest/v1/tickers"))
      return route.fulfill({ status: 200, contentType: "application/json",
        headers: { "access-control-allow-origin": "*" }, body: CATALOGUE });
    if (url.includes("s.tradingview.com") || url.includes("tradingview-widget.com")) return route.continue();
    blocked += 1;
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`  PAGE ERROR @${width}:`, e.message.slice(0, 120)));

  const shot = async (name, note) => {
    const file = path.join(OUT, `${name}-${width}.png`);
    await page.screenshot({ path: file });
    const state = await page.evaluate(() => ({
      scene: document.getElementById("sceneMode")?.value,
      tfNow: document.getElementById("tfNow")?.textContent,
      tfReadout: document.getElementById("tfReadout")?.textContent,
      tucked: !!document.getElementById("dock")?.classList.contains("tucked"),
      copyHidden: document.getElementById("copyLayout")?.hidden,
      copyText: document.getElementById("copyLayout")?.textContent,
      note: document.getElementById("symbolNote")?.textContent,
      screen: document.getElementById("screenIndicator")?.textContent,
      slots: Array.from({ length: 8 }, (_, i) => document.getElementById("t" + (i + 1))?.value ?? null),
      cards: Array.from(document.querySelectorAll(".pane .card .go")).map((n) => n.textContent),
      frames: Array.from(document.querySelectorAll(".chart-pane iframe")).length,
      why: Array.from(document.querySelectorAll(".pane > .why")).map((n) => n.textContent).filter(Boolean)
    }));
    seen.push({ name, width, note, ...state });
    console.log(`\n${name} @${width} — ${note}`);
    console.log("  " + JSON.stringify(state).slice(0, 460));
  };

  const go = async (scene, wait = 3500) => {
    await page.goto(`${ORIGIN}/deck/?scene=${scene}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(wait);
  };

  /* 1 — SCRATCH, empty */
  await go("scratch");
  await shot("scratch-empty", "the ending screen as it opens: six empty slots");

  /* 2 — the timeframe label, with the strip tucked away */
  await page.evaluate(() => { try { window.tuckDock && window.tuckDock(); } catch (_) {} });
  await page.waitForTimeout(500);
  await shot("scratch-tucked-timeframe", "the strip tucked: the timeframe chip is the answer on screen");
  await page.evaluate(() => { try { window.revealDock && window.revealDock(); } catch (_) {} });
  await page.waitForTimeout(300);

  /* 3 — six tickers typed in, by the path a person actually uses: tap the empty slot,
     which opens its field, then type and press Return. */
  for (const [i, t] of ["SPY","QQQ","NVDA","MU","AAPL","TSLA"].entries()) {
    const key = "c" + (i + 1);
    await page.click(`.pane[data-key="${key}"] .card`, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(250);
    const box = await page.$("#t" + (i + 1));
    if (!box) continue;
    await box.fill(t); await page.keyboard.press("Enter");
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(5000);
  await shot("scratch-six", "six symbols typed in, charts loaded from the chart API");

  /* 4 — clearing a field empties that slot. A filled slot opens its field the way the product
     opens it: the ticker name on the chart badge asks the deck to focus it. */
  try {
    await page.frameLocator('.pane[data-key="c3"] iframe').locator(".sc-nchart__live-ticker").first()
      .click({ timeout: 8000 });
  } catch (_) { await page.evaluate(() => window.focusTickerFor && window.focusTickerFor("c3")); }
  await page.waitForTimeout(400);
  const third = await page.$("#t3");
  if (third) { await third.fill(""); await page.keyboard.press("Enter"); }
  await page.waitForTimeout(1500);
  await shot("scratch-cleared", "slot 3 cleared: the chart is gone and the slot says what it is");

  /* 5 — copy layout */
  const copied = await page.evaluate(async () => {
    const before = document.getElementById("copyLayout").textContent;
    document.getElementById("copyLayout").click();
    await new Promise((r) => setTimeout(r, 400));
    return { before, after: document.getElementById("copyLayout").textContent,
             note: document.getElementById("symbolNote").textContent };
  });
  console.log("  copy layout ->", JSON.stringify(copied));
  seen.push({ name: "copy-layout", width, note: "the line the button hands back", ...copied });
  await shot("scratch-copied", "copy layout pressed");

  /* 6 — TO-DO */
  await go("todo", 12000);
  await shot("todo", "the reminders, each captioned with why it is here");

  /* 7 — INTERNALS, now VIX and PCC alone */
  await go("internalsFast", 6000);
  await shot("internals", "VIX and PCC on their own, drawn from our own series");

  console.log(`\n@${width}: chart-API requests proxied ${proxied}, other off-origin requests blocked ${blocked}`);
  seen.push({ name: "requests", width, proxied, blocked });
  await ctx.close();
}
await browser.close(); srv.close();
fs.writeFileSync(path.join(OUT, "station-scratch-shots.json"), JSON.stringify({ at: new Date().toISOString(), seen }, null, 1));
console.log("\nwrote", OUT);
